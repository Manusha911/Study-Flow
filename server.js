import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Database config & middleware
import connectDB from './config/db.js';
import { protect } from './middleware/auth.js';

// MongoDB Models
import User from './models/User.js';
import Assignment from './models/Assignment.js';
import Timetable from './models/Timetable.js';
import Note from './models/Note.js';
import StudySession from './models/StudySession.js';

// Initialize environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Configure ESM paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
// Allow larger request payloads for base64 file and image uploads (limit set to 15MB)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(cors());

// Token Generator Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'studyflowsecretkey', {
    expiresIn: '30d',
  });
};

// ─── AUTHENTICATION ROUTES ───

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, university } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      university: university || '',
    });

    if (user) {
      res.status(201).json({
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          university: user.university,
          profilePhoto: user.profilePhoto,
        }
      });
    } else {
      res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          university: user.university,
          profilePhoto: user.profilePhoto,
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Profile
app.get('/api/auth/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        university: user.university,
        profilePhoto: user.profilePhoto,
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update User Profile
app.put('/api/auth/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.university !== undefined) {
        user.university = req.body.university;
      }
      if (req.body.profilePhoto !== undefined) {
        user.profilePhoto = req.body.profilePhoto;
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        university: updatedUser.university,
        profilePhoto: updatedUser.profilePhoto,
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ─── ASSIGNMENTS ROUTES ───

// Get all user assignments
app.get('/api/assignments', protect, async (req, res) => {
  try {
    const assignments = await Assignment.find({ userId: req.user._id }).sort({ deadline: 1 });
    res.json(assignments.map(a => ({
      id: a._id,
      subject: a.subject,
      title: a.title,
      description: a.description,
      deadline: a.deadline,
      status: a.status,
      createdAt: a.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new assignment
app.post('/api/assignments', protect, async (req, res) => {
  const { subject, title, description, deadline, status } = req.body;
  try {
    const a = await Assignment.create({
      userId: req.user._id,
      subject,
      title,
      description: description || '',
      deadline,
      status: status || 'pending',
    });
    res.status(201).json({
      id: a._id,
      subject: a.subject,
      title: a.title,
      description: a.description,
      deadline: a.deadline,
      status: a.status,
      createdAt: a.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update assignment status or fields
app.put('/api/assignments/:id', protect, async (req, res) => {
  try {
    const a = await Assignment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!a) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    a.subject = req.body.subject !== undefined ? req.body.subject : a.subject;
    a.title = req.body.title !== undefined ? req.body.title : a.title;
    a.description = req.body.description !== undefined ? req.body.description : a.description;
    a.deadline = req.body.deadline !== undefined ? req.body.deadline : a.deadline;
    a.status = req.body.status !== undefined ? req.body.status : a.status;

    await a.save();
    res.json({
      id: a._id,
      subject: a.subject,
      title: a.title,
      description: a.description,
      deadline: a.deadline,
      status: a.status,
      createdAt: a.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete assignment
app.delete('/api/assignments/:id', protect, async (req, res) => {
  try {
    const a = await Assignment.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!a) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ─── TIMETABLE ROUTES ───

// Get all timetable entries
app.get('/api/timetable', protect, async (req, res) => {
  try {
    const timetable = await Timetable.find({ userId: req.user._id }).sort({ time: 1 });
    res.json(timetable.map(t => ({
      id: t._id,
      day: t.day,
      time: t.time,
      subject: t.subject,
      activity: t.activity,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add timetable entry
app.post('/api/timetable', protect, async (req, res) => {
  const { day, time, subject, activity } = req.body;
  try {
    const t = await Timetable.create({
      userId: req.user._id,
      day,
      time,
      subject,
      activity: activity || '',
    });
    res.status(201).json({
      id: t._id,
      day: t.day,
      time: t.time,
      subject: t.subject,
      activity: t.activity,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete timetable entry
app.delete('/api/timetable/:id', protect, async (req, res) => {
  try {
    const t = await Timetable.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!t) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    res.json({ message: 'Timetable entry deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ─── NOTES ROUTES ───

// Get all notes
app.get('/api/notes', protect, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json(notes.map(n => ({
      id: n._id,
      title: n.title,
      content: n.content,
      attachments: n.attachments.map(att => ({
        id: att.id,
        name: att.name,
        type: att.type,
        size: att.size,
        dataUrl: att.dataUrl,
      })),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add note
app.post('/api/notes', protect, async (req, res) => {
  const { title, content, attachments } = req.body;
  try {
    const n = await Note.create({
      userId: req.user._id,
      title,
      content: content || '',
      attachments: attachments || [],
    });
    res.status(201).json({
      id: n._id,
      title: n.title,
      content: n.content,
      attachments: n.attachments,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update note
app.put('/api/notes/:id', protect, async (req, res) => {
  try {
    const n = await Note.findOne({ _id: req.params.id, userId: req.user._id });
    if (!n) {
      return res.status(404).json({ error: 'Note not found' });
    }

    n.title = req.body.title !== undefined ? req.body.title : n.title;
    n.content = req.body.content !== undefined ? req.body.content : n.content;
    n.attachments = req.body.attachments !== undefined ? req.body.attachments : n.attachments;

    await n.save();
    res.json({
      id: n._id,
      title: n.title,
      content: n.content,
      attachments: n.attachments,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete note
app.delete('/api/notes/:id', protect, async (req, res) => {
  try {
    const n = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!n) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ─── STUDY SESSIONS ROUTES ───

// Get study sessions
app.get('/api/sessions', protect, async (req, res) => {
  try {
    const sessions = await StudySession.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(sessions.map(s => ({
      id: s._id,
      date: s.date,
      duration: s.duration,
      subject: s.subject,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log study session
app.post('/api/sessions', protect, async (req, res) => {
  const { date, duration, subject } = req.body;
  try {
    const s = await StudySession.create({
      userId: req.user._id,
      date,
      duration,
      subject: subject || 'Pomodoro',
    });
    res.status(201).json({
      id: s._id,
      date: s.date,
      duration: s.duration,
      subject: s.subject,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── STATIC STATIC ASSETS & FILES ROUTING ───

// Serve static assets folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve app.js and favicon files directly
app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets/logo.png'));
});

// Catch-all route to serve index.html for frontend routing (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Launch server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open in browser: http://localhost:${PORT}`);
});

