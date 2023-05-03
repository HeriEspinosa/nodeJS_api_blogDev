const Post = require('./../models/post.model');
const { db } = require('./../database/config');

const catchAsync = require('../utils/catchAsync');
const User = require('../models/user.model');
const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { upload } = require('../utils/multer');
const PostImg = require('../models/postImg.model');
const { storage } = require('../utils/firebase');

exports.findAllPost = catchAsync(async (req, res, next) => {
  const posts = await Post.findAll({
    where: {
      status: 'active',
    },
    attributes: {
      exclude: ['userId', 'status'],
    },
    include: [
      {
        model: User,
        attributes: ['id', 'name', 'profileImgUrl'],
        //punto a
      },
      {
        model: PostImg,
      },
    ],
    order: [['createdAt', 'DESC']], //ASC = ascendente; DESC = descendente
    limit: 20,
  });

  const postsPromises = posts.map(async (post) => {
    const postImgsPromises = post.postImgs.map(async (postImg) => {
      const imgRef = ref(storage, postImg.postImgUrl);
      const url = await getDownloadURL(imgRef);

      postImg.postImgUrl = url;
      return postImg;
    });

    const imgRefUser = ref(storage, post.user.profileImgUrl);
    const urlProfile = await getDownloadURL(imgRefUser);

    post.user.profileImgUrl = urlProfile;

    const postImgsResolved = await Promise.all(postImgsPromises);
    post.postImg = postImgsResolved;

    return posts;
  });

  const postResolved = await Promise.all(postsPromises);

  return res.status(200).json({
    status: 'success',
    results: posts.length,
    posts: postResolved,
  });
});

exports.createPost = catchAsync(async (req, res, next) => {
  const { title, content } = req.body;
  const { sessionUser } = req;

  const post = await Post.create({
    title,
    content,
    userId: sessionUser.id,
  });

  const postImgsPromises = req.files.map(async (file) => {
    const imgRef = ref(storage, `post/${Date.now()}-${file.originalname}`);

    const imgUploaded = await uploadBytes(imgRef, file.buffer);

    return await PostImg.create({
      postId: post.id,
      postImgUrl: imgUploaded.metadata.fullPath,
    });
  });

  await Promise.all(postImgsPromises);

  return res.status(201).json({
    status: 'success',
    message: 'The post has been created',
    post,
  });
});

exports.findMyPosts = catchAsync(async (req, res, next) => {
  const { sessionUser } = req;

  const query = `SELECT * FROM posts WHERE "userId" = :idusuario AND status = :status`;

  const [rows, fields] = await db.query(query, {
    replacements: {
      idusuario: sessionUser.id,
      status: 'active',
    },
  });

  return res.status(200).json({
    status: 'success',
    results: fields.rowCount,
    posts: rows,
  });
});

exports.findUserPost = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const posts = await Post.findAll({
    where: {
      userId: id,
      status: 'active',
    },
    include: [
      {
        model: User,
        attributes: { exclude: ['password', 'passwordChangedAt'] },
      },
    ],
  });

  res.status(200).json({
    status: 'success',
    results: posts.length,
    posts,
  });
});

exports.findOnePost = catchAsync(async (req, res, next) => {
  const { post } = req;

  const imgRefUserProfile = ref(storage, post.user.profileImgUrl);
  const urlProfileUser = await getDownloadURL(imgRefUserProfile);

  post.user.profileImgUrl = urlProfileUser;

  const postImgsPromises = post.postImgs.map(async (postImg) => {
    const imgPostRef = ref(storage, postImg.postImgUrl);
    const urlPostImg = await getDownloadURL(imgPostRef);

    postImg.postImgUrl = urlPostImg;
    return postImg;
  });

  const commentImgsPromises = post.comments.map(async (comment) => {
    const imgCommentRef = ref(storage, comment.user.profileImgUrl);
    const urlCommentImg = await getDownloadURL(imgCommentRef);

    comment.user.profileImgUrl = urlCommentImg;
    return comment;
  });

  const arrPromises = [...postImgsPromises, ...commentImgsPromises];
  await Promise.all(arrPromises);

  res.status(200).json({
    status: 'success',
    post,
  });
});

/* This code exports a function called `updatePost` that is used to update a post in the database. It
uses the `catchAsync` middleware to handle any errors that may occur during the execution of the
function. The function receives the `req`, `res`, and `next` parameters, and it extracts the
`title`, `content`, and `post` from the `req` object. Then, it updates the `post` object with the
new `title` and `content` values using the `update` method. Finally, it sends a JSON response with a
success status and a message indicating that the post has been updated. */
exports.updatePost = catchAsync(async (req, res, next) => {
  const { title, content } = req.body;
  const { post } = req;

  await post.update({ title, content });

  res.status(200).json({
    status: 'success',
    message: 'The post has been updated',
  });
});

/* This code exports a function called `deletePost` that is used to delete a post from the database. It
uses the `catchAsync` middleware to handle any errors that may occur during the execution of the
function. */
exports.deletePost = catchAsync(async (req, res, next) => {
  const { post } = req;

  await post.update({ status: 'disabled' });

  return res.status(200).json({
    status: 'success',
    message: 'The post has been deleted',
  });
});
