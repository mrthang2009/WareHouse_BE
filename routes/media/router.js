var express = require("express");
var router = express.Router();
const access = require("../../middlewares/access");

const {
  uploadImageCategory,
  uploadImageProduct,
  uploadAvatarMe,
  uploadSingle,
  uploadMultipleImages,
} = require("./controller");

router.route("/upload-file-category/:categoryId").post(uploadImageCategory);
router.route("/upload-file-product/:productId").post(uploadImageProduct);
router
  .route("/upload-avatar-me")
  .post(access.checkRole(["MANAGE", "SALES", "SHIPPER"]), uploadAvatarMe);

router.route("/upload-multiple-images").post(uploadMultipleImages);
router.route("/upload-single").post(uploadSingle);

module.exports = router;
