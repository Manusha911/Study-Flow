import mongoose from 'mongoose';

const TimetableSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  day: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  activity: {
    type: String,
    default: '',
  }
}, {
  timestamps: true,
});

const Timetable = mongoose.model('Timetable', TimetableSchema);
export default Timetable;
