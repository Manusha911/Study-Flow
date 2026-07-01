import mongoose from 'mongoose';

const NoteAttachmentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  dataUrl: {
    type: String,
    required: true,
  }
});

const NoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  attachments: [NoteAttachmentSchema]
}, {
  timestamps: true,
});

const Note = mongoose.model('Note', NoteSchema);
export default Note;
