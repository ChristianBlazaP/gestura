const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const ctrl = require("../controllers/profileController");
const upload = require("../middleware/uploadMiddleware");

router.get("/", authMiddleware, ctrl.getProfile);
router.put("/bio", authMiddleware, ctrl.updateBio);
router.put("/avatar", authMiddleware, ctrl.updateAvatar);
router.put("/cover", authMiddleware, ctrl.updateCover);
router.post("/avatar/upload", authMiddleware, upload.single("image"), ctrl.uploadAvatarFile);
router.post("/cover/upload", authMiddleware, upload.single("image"), ctrl.uploadCoverFile);
router.get("/photos", authMiddleware, ctrl.listPhotos);
router.get("/photos/:userId", authMiddleware, ctrl.listPhotosByUser);
router.post("/photos", authMiddleware, ctrl.addPhoto);
router.post("/photos/upload", authMiddleware, upload.single("image"), ctrl.uploadPhotoFile);
router.post("/photos/:id/like", authMiddleware, ctrl.toggleLike);

module.exports = router;
