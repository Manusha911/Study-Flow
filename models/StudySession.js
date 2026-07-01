import mongoose from 'mongoose';

const StudySessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  subject: {
    type: String,
    default: 'Pomodoro',
  }
}, {
  timestamps: true,
});

const StudySession = mongoose.model('StudySession', StudySessionSchema);
export default StudySession;
