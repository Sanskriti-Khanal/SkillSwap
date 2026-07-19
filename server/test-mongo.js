require('dotenv').config();
const mongoose = require('mongoose');
const TutorDocuments = require('./src/models/TutorDocuments');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/skillswap')
  .then(async () => {
    const docs = await TutorDocuments.find({});
    console.log("Documents:", docs);
    const users = await User.find({});
    console.log("Users:", users.map(u => ({ id: u._id, photo: u.profile_photo_url })));
    process.exit(0);
  });
