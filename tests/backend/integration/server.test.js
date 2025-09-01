const request = require('supertest');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const TodoController = require('../../../controllers/todoController');
const StorageService = require('../../../services/storageService');

// Test data file path
const TEST_DATA_FILE = path.join(__dirname, '../../../data/test-todos.json');

// Create a test app with isolated storage
function createTestApp() {
  const app = express();
  
  // Configure CORS middleware
  const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security headers middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Static file serving for frontend assets
  app.use(express.static(path.join(__dirname, '../../../public')));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Initialize todo controller with test storage
  const testStorageService = new StorageService(TEST_DATA_FILE);
  const todoController = new TodoController();
  todoController.todoService.storageService = testStorageService;

  // API routes
  app.get('/api/todos', (req, res) => todoController.getAllTodos(req, res));
  app.post('/api/todos', (req, res) => todoController.createTodo(req, res));
  app.put('/api/todos/:id', (req, res) => todoController.updateTodo(req, res));
  app.delete('/api/todos/:id', (req, res) => todoController.deleteTodo(req, res));

  // Catch-all route for SPA
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../../../public', 'index.html'), (err) => {
      if (err) {
        res.status(500).json({
          success: false,
          error: 'Failed to serve application'
        });
      }
    });
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.originalUrl
    });
  });

  // Global error handling middleware
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON in request body'
      });
    }

    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        error: 'Request body too large'
      });
    }

    const statusCode = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message;

    res.status(statusCode).json({
      success: false,
      error: message
    });
  });

  return app;
}

// Helper function to clean up test data
async function cleanupTestData() {
  try {
    await fs.unlink(TEST_DATA_FILE);
  } catch (error) {
    // File doesn't exist, which is fine
  }
}

// Helper function to create test data
async function createTestData(todos = []) {
  const dataDir = path.dirname(TEST_DATA_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
  await fs.writeFile(TEST_DATA_FILE, JSON.stringify(todos, null, 2));
}

// Import the original app for server setup tests
const { app: originalApp } = require('../../../server');

describe('Express Server Setup', () => {
  describe('Middleware Configuration', () => {
    test('should handle CORS headers', async () => {
      const response = await request(originalApp)
        .get('/health')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should parse JSON requests', async () => {
      const response = await request(originalApp)
        .post('/api/todos')
        .send({ description: 'Test todo' })
        .set('Content-Type', 'application/json');
      
      // Should not fail due to JSON parsing issues
      expect(response.status).not.toBe(400);
    });

    test('should set security headers', async () => {
      const response = await request(originalApp)
        .get('/health')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Static File Serving', () => {
    test('should serve static files from public directory', async () => {
      const response = await request(originalApp)
        .get('/index.html')
        .expect(200);
      
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('should serve CSS files', async () => {
      const response = await request(originalApp)
        .get('/css/styles.css')
        .expect(200);
      
      expect(response.headers['content-type']).toMatch(/text\/css/);
    });

    test('should serve JavaScript files', async () => {
      const response = await request(originalApp)
        .get('/js/app.js')
        .expect(200);
      
      expect(response.headers['content-type']).toMatch(/application\/javascript/);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent API routes', async () => {
      const response = await request(originalApp)
        .get('/api/nonexistent')
        .expect(404);
      
      expect(response.body).toEqual({
        success: false,
        error: 'API endpoint not found',
        path: '/api/nonexistent'
      });
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(originalApp)
        .post('/api/todos')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/Invalid JSON/);
    });
  });

  describe('Health Check Endpoint', () => {
    test('should return server status', async () => {
      const response = await request(originalApp)
        .get('/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'OK',
        message: 'Server is running',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('SPA Route Handling', () => {
    test('should serve index.html for non-API routes', async () => {
      const response = await request(originalApp)
        .get('/some-frontend-route')
        .expect(200);
      
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('should not serve index.html for API routes', async () => {
      const response = await request(originalApp)
        .get('/api/nonexistent')
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
});

