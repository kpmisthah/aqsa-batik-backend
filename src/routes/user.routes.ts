import express from 'express';
import { getUsers, createUser, updateUser, toggleBlockUser, deleteUser } from '../controllers/UserController.js';

const router = express.Router();

router.route('/').get(getUsers).post(createUser);
router.route('/:id').put(updateUser).delete(deleteUser);
router.route('/:id/toggle-block').patch(toggleBlockUser);

export default router;
