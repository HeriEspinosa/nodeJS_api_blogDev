const { ref, getDownloadURL } = require('firebase/storage');
const User = require('../models/user.model');
const catchAsync = require('../utils/catchAsync');
const { storage } = require('../utils/firebase');
const Post = require('../models/post.model');
const Comment = require('../models/comment.model');

exports.findAll = catchAsync(async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ['password', 'passwordChangedAt', 'status'] },
    where: {
      status: 'active',
    },
    include: [
      {
        model: Post,
        include: [{ model: Comment }],
      },
    ],
  });

  const userPromises = users.map(async (user) => {
    const imgRef = ref(storage, user.profileImgUrl);
    const url = await getDownloadURL(imgRef);

    user.profileImgUrl = url;
    return user;
  });

  const userResolved = await Promise.all(userPromises);

  res.status(200).json({
    status: 'success',
    results: users.length,
    users: userResolved,
  });
});

exports.findOne = catchAsync(async (req, res) => {
  const { user } = req;

  const imgRef = ref(storage, user.profileImgUrl);
  const url = await getDownloadURL(imgRef);

  user.profileImgUrl = url;

  return res.status(200).json({
    status: 'success',
    user,
  });
});

exports.update = catchAsync(async (req, res) => {
  const { name, email } = req.body;
  const { user } = req;

  await user.update({ name, email });

  return res.status(200).json({
    status: 'success',
    message: 'the user has been updated',
  });
});

exports.delete = catchAsync(async (req, res) => {
  const { user } = req;

  await user.update({ status: 'disabled' });

  return res.status(200).json({
    status: 'success',
    message: 'the user has been deleted',
  });
});
