/**
 * NEXTEP CRM - Auth Routes
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth');

// Validações
const registerValidation = [
  body('companyName').trim().notEmpty().withMessage('Nome da empresa é obrigatório'),
  body('companyEmail').isEmail().normalizeEmail().withMessage('E-mail da empresa inválido'),
  body('adminName').trim().notEmpty().withMessage('Nome do administrador é obrigatório'),
  body('adminEmail').isEmail().normalizeEmail().withMessage('E-mail do administrador inválido'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória')
];

// Rotas
router.post('/register', registerValidation, authController.registerCompany);
router.post('/login', loginValidation, authController.login);
router.post('/refresh', authController.refresh);
router.get('/me', require('../middlewares/auth'), authController.me);
router.post('/logout', require('../middlewares/auth'), authController.logout);
router.post('/forgot-password', body('email').isEmail(), authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
