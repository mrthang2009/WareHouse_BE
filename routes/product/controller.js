const axios = require("axios");
const qrcode = require("qrcode");
const fs = require("fs");
const cloudflare = require("cloudflare");
const { Product, Media } = require("../../models");
const { fuzzySearch, generateUniqueFileName } = require("../../utils");

const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
});

module.exports = {
  createProduct: async (req, res, next) => {
    const {
      name,
      price,
      discount,
      stock,
      categoryId,
      supplierId,
      description,
      weight,
      length,
      height,
      width,
    } = req.body;

    try {
      const newProduct = new Product({
        name,
        price,
        discount,
        stock,
        supplierId,
        categoryId,
        description,
        weight,
        length,
        height,
        width,
      });

      const savedProduct = await newProduct.save();

      // Tạo mã QR từ ID của sản phẩm
      const productId = savedProduct._id.toString();
      const qrCodeData = JSON.stringify({
        productId: productId,
      });
      // Tạo hình ảnh QRCode
      const qrCodeBuffer = await qrcode.toBuffer(qrCodeData);

      // Tiếp theo, xử lý upload file và tạo media cho cả QR Code và ảnh đưa lên Cloudflare
      const S3 = new S3Client({
        region: "auto",
        endpoint: process.env.ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      // Xử lý upload ảnh QR Code
      const qrCodeFileName = generateUniqueFileName(qrCodeBuffer);
      await S3.send(
        new PutObjectCommand({
          Body: qrCodeBuffer,
          Bucket: "warehouse",
          Key: qrCodeFileName,
          ContentType: "image/png",
        })
      );
      const qrCodeUrl = `${process.env.R2_DEV_URL}/warehouse/${qrCodeFileName}`;
      const media = new Media({
        qrCodeUrl: qrCodeUrl,
        size: qrCodeBuffer.length,
      });
      const savedMedia = await media.save();

      // Cập nhật sản phẩm với mediaId
      savedProduct.mediaId = savedMedia._id;
      await savedProduct.save();
      // Đóng đối tượng S3Client sau khi sử dụng
      S3.destroy();

      // Trả về phản hồi sau khi đã thực hiện tất cả công việc
      return res.status(200).json({
        message: "Add product successfully",
        payload: savedProduct,
        qrCodeUrl: qrCodeUrl,
      });
    } catch (error) {
      console.log("««««« error »»»»»", error);
      return res.status(400).json({ message: "Adding product failed", error });
    }
  },

  getAllProduct: async (req, res, next) => {
    try {
      let payload = await Product.find({
        isDeleted: false,
      })
        .populate("category")
        .populate("media")
        .lean();
      const totalProduct = await Product.countDocuments(payload);
      return res.status(200).json({
        message: "Retrieve products data successfully",
        totalProduct,
        payload,
      });
    } catch (error) {
      console.log("««««« error »»»»»", error);
      return res
        .status(400)
        .json({ message: "Retrieving products data failed", error });
    }
  },

  getListProduct: async (req, res, next) => {
    try {
      const { page, pageSize } = req.query;
      const limit = pageSize || 9;
      const skip = limit * (page - 1) || 0;
      let payload = await Product.find({ isDeleted: false })
        .populate("category")
        // .populate("supplier")
        .populate("media")
        .skip(skip)
        .limit(limit)
        .sort({ name: 1, price: 1, discount: -1 });

      const totalProduct = await Product.countDocuments({ isDeleted: false });
      return res.status(200).json({
        message: "Retrieve products data successfully",
        totalProduct,
        count: payload.length,
        payload,
      });
    } catch (error) {
      return res
        .status(400)
        .json({ message: "Retrieving orders data failed", error });
    }
  },

  getDetailProduct: async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = await Product.findOne({
        _id: id,
        isDeleted: false,
      })
        //Hiển thị thêm chi tiết về category, supplier trong data
        .populate("category")
        .populate("supplier")
        .populate("media")
        .lean();
      if (!payload) {
        return res.status(400).json({ message: "No product found in data" });
      }
      return res.status(200).json({
        message: "Retrieve detailed product data successfully",
        payload,
      });
    } catch (error) {
      console.log("««««« error »»»»»", error);
      return res
        .status(400)
        .json({ message: "Retrieving detailed product data failed", error });
    }
  },

  updateProduct: async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = await Product.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { ...req.body },
        { new: true }
      );

      if (!payload) {
        return res.status(400).json({ message: "No product found in data" });
      }
      if (payload) {
        await axios.get(
          `http://user-e-commerce.vercel.app/api/revalidate-product-list?secret=ADB57C459465E3ED43C6C623SLDFSLKDFNSKLDNFDLADB57C459465E3ED43C6C623SLDFSLKDFNSKLDNFDLADB57C459465E3ED43C6C623SLDFSLKDFNSKLDNFDL&categoryId=${payload.categoryId}`
        );
        return res
          .status(200)
          .json({ message: "Updated product data successfully", payload });
      }
    } catch (error) {
      console.log("««««« error »»»»»", error);
      return res
        .status(400)
        .json({ message: "Updating employee data failed", error });
    }
  },

  deleteProduct: async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = await Product.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      );
      if (!payload) {
        return res.status(400).json({ message: "No product found in data" });
      }
      // await axios.get(
      //   `http://user-e-commerce.vercel.app/api/revalidate-product-list?secret=ADB57C459465E3ED43C6C623SLDFSLKDFNSKLDNFDLADB57C459465E3ED43C6C623SLDFSLKDFNSKLDNFDLADB57C459465E3ED43C6C623SLDFSLKDFNSKLDNFDL&categoryId=${payload.categoryId}`
      // );
      return res
        .status(200)
        .json({ message: "Delete product data successfully" });
    } catch (error) {
      console.log("««««« error »»»»»", error);
      return res
        .status(400)
        .json({ message: "Delete product data failed", error });
    }
  },

  searchProduct: async (req, res, next) => {
    try {
      const { keyword } = req.query;

      const conditionFind = { isDeleted: false };

      const payload = await Product.find({
        ...conditionFind,
        name: { $regex: fuzzySearch(keyword) },
      })
        .populate("media")
        .populate("category")
        .populate("supplier")
        .sort({ name: 1 });

      // Tính tổng số sản phẩm thỏa mãn điều kiện
      const totalProduct = await Product.countDocuments(conditionFind);

      if (payload) {
        return res.status(200).json({
          message: "Search information of product successfully",
          totalProduct,
          count: payload.length,
          payload,
        });
      }

      return res.status(410).json({
        message: "Search information of product not found",
      });
    } catch (err) {
      return res.status(404).json({
        message: "Search information of product failed",
        error: err,
      });
    }
  },

  // Controller để lọc sản phẩm
  filterProducts: async (req, res, next) => {
    try {
      const { keyword, categoryId, sortPrice, sortDiscount } = req.query;

      // Bắt đầu với điều kiện mặc định là tất cả sản phẩm không bị xóa
      let condition = { isDeleted: false };

      if (keyword) {
        // Lọc sản phẩm theo tên sản phẩm (sử dụng biểu thức chính quy)
        condition.name = { $regex: fuzzySearch(keyword) };
      }

      if (categoryId) {
        // Lọc sản phẩm theo danh mục sản phẩm
        condition.categoryId = categoryId; // Sử dụng ID danh mục sản phẩm
      }

      const sortOptions = {};

      if (sortPrice) {
        // Sắp xếp theo giá tăng hoặc giảm
        if (sortPrice === "asc") {
          sortOptions.price = 1;
        }
        if (sortPrice === "desc") {
          sortOptions.price = -1;
        }
      }

      if (sortDiscount) {
        // Sắp xếp theo giảm giá tăng hoặc giảm
        if (sortDiscount === "asc") {
          sortOptions.discount = 1;
        }
        if (sortDiscount === "desc") {
          sortOptions.discount = -1;
        }
      }

      const products = await Product.find(condition)
        .populate("category")
        .populate("media")
        .populate("supplier")
        .sort(sortOptions);

      return res.status(200).json({
        message: "Filtered products successfully",
        count: products.length,
        payload: products,
      });
    } catch (error) {
      return res.status(400).json({
        message: "Filtering products failed",
        error,
      });
    }
  },
};
