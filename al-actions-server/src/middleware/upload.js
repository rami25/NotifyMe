import multer from 'multer';

const storage = multer.memoryStorage();

const MULTER_DEFAULTS = {
  storage,
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
};

export const upload = multer(MULTER_DEFAULTS);
