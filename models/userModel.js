const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  mobile: {
    required: true,
    type: String,
    unique: true,   
  },
  password: {
    type: String,
    required: true,
  },
  transactionId: {
    type: String,
    required: false,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'team', 'admin'],
    default: 'user',
  },
}, { timestamps: true });
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
})
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
}
module.exports = mongoose.model('User', userSchema);  