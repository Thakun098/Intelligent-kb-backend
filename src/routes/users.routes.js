const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middleware/auth');
const rbacMiddleware = require('../middleware/rbac');
const { validate, schemas } = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management (Admin — CONFIDENTIAL_ADMIN only)
 */

// All endpoints require CONFIDENTIAL_ADMIN level clearance
router.use(authMiddleware);
router.use(rbacMiddleware('CONFIDENTIAL_ADMIN'));

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users (password hash excluded)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of user objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Insufficient clearance level
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, clearance_level, department]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: new_staff
 *               password:
 *                 type: string
 *                 description: Min 8 chars, must include uppercase, lowercase, digit, special character
 *                 example: Staff@1234
 *               clearance_level:
 *                 type: string
 *                 enum: [GENERAL_NEWBIE, PERMANENT_STAFF, CONFIDENTIAL_ADMIN]
 *               department:
 *                 type: string
 *                 example: Engineering
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation failed or username already taken
 *       403:
 *         description: Insufficient clearance level
 */
router.get('/', usersController.listUsers);
router.post('/', validate(schemas.createUserSchema), usersController.createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user clearance level or department
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clearance_level:
 *                 type: string
 *                 enum: [GENERAL_NEWBIE, PERMANENT_STAFF, CONFIDENTIAL_ADMIN]
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *   delete:
 *     summary: Deactivate (delete) a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deactivated
 *       404:
 *         description: User not found
 */
router.put('/:id', validate(schemas.updateUserSchema), usersController.updateUser);
router.delete('/:id', usersController.deactivateUser);

module.exports = router;
