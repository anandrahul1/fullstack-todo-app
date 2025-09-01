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

  // Initialize todo controller with test storage
  const testStorageService = new StorageService(TEST_DATA_FILE);
  const todoController = new TodoController();
  todoController.todoService.storageService = testStorageService;

  // API routes
  app.get('/api/todos', (req, res) => todoController.getAllTodos(req, res));
  app.post('/api/todos', (req, res) => todoController.createTodo(req, res));
  app.put('/api/todos/:id', (req, res) => todoController.updateTodo(req, res));
  app.delete('/api/todos/:id', (req, res) => todoController.deleteTodo(req, res));

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

describe('Todo API Endpoints', () => {
  let testApp;

  beforeEach(async () => {
    await cleanupTestData();
    testApp = createTestApp();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('GET /api/todos', () => {
    test('should return empty array when no todos exist', async () => {
      const response = await request(testApp)
        .get('/api/todos')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        data: [],
        message: 'No todos found'
      });
    });

    test('should return all todos when they exist', async () => {
      // Create test data
      const testTodos = [
        {
          id: 'test-id-1',
          description: 'Test todo 1',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'test-id-2',
          description: 'Test todo 2',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      await createTestData(testTodos);

      const response = await request(testApp)
        .get('/api/todos')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        id: 'test-id-1',
        description: 'Test todo 1',
        completed: false
      });
      expect(response.body.data[1]).toMatchObject({
        id: 'test-id-2',
        description: 'Test todo 2',
        completed: true
      });
    });

    test('should handle storage errors gracefully', async () => {
      // Create invalid JSON file to simulate storage error
      const dataDir = path.dirname(TEST_DATA_FILE);
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(TEST_DATA_FILE, 'invalid json');

      const response = await request(testApp)
        .get('/api/todos')
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve todos');
    });
  });

  describe('POST /api/todos', () => {
    test('should create a new todo with valid description', async () => {
      const todoData = { description: 'New test todo' };

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        description: 'New test todo',
        completed: false,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
      expect(response.body.message).toBe('Todo created successfully');
    });

    test('should reject empty description', async () => {
      const todoData = { description: '' };

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Description cannot be empty');
    });

    test('should reject whitespace-only description', async () => {
      const todoData = { description: '   ' };

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Description cannot be empty');
    });

    test('should reject missing description', async () => {
      const todoData = {};

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Description is required and must be a string');
    });

    test('should reject non-string description', async () => {
      const todoData = { description: 123 };

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Description is required and must be a string');
    });

    test('should reject description longer than 500 characters', async () => {
      const todoData = { description: 'a'.repeat(501) };

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Description cannot exceed 500 characters');
    });

    test('should trim whitespace from description', async () => {
      const todoData = { description: '  Test todo with spaces  ' };

      const response = await request(testApp)
        .post('/api/todos')
        .send(todoData)
        .expect(201);
      
      expect(response.body.data.description).toBe('Test todo with spaces');
    });
  });

  describe('PUT /api/todos/:id', () => {
    let testTodoId;

    beforeEach(async () => {
      // Create a test todo first
      const response = await request(testApp)
        .post('/api/todos')
        .send({ description: 'Test todo for update' });
      testTodoId = response.body.data.id;
    });

    test('should update todo description', async () => {
      const updates = { description: 'Updated description' };

      const response = await request(testApp)
        .put(`/api/todos/${testTodoId}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.message).toBe('Todo updated successfully');
    });

    test('should update todo completion status', async () => {
      const updates = { completed: true };

      const response = await request(testApp)
        .put(`/api/todos/${testTodoId}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.completed).toBe(true);
    });

    test('should update both description and completion status', async () => {
      const updates = { 
        description: 'Updated and completed',
        completed: true 
      };

      const response = await request(testApp)
        .put(`/api/todos/${testTodoId}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('Updated and completed');
      expect(response.body.data.completed).toBe(true);
    });

    test('should return 404 for non-existent todo', async () => {
      const updates = { description: 'Updated description' };

      const response = await request(testApp)
        .put('/api/todos/non-existent-id')
        .send(updates)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Todo not found');
    });

    test('should reject empty description update', async () => {
      const updates = { description: '' };

      const response = await request(testApp)
        .put(`/api/todos/${testTodoId}`)
        .send(updates)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Description cannot be empty');
    });

    test('should reject invalid completion status', async () => {
      const updates = { completed: 'invalid' };

      const response = await request(testApp)
        .put(`/api/todos/${testTodoId}`)
        .send(updates)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Completed status must be a boolean');
    });

    test('should reject missing updates object', async () => {
      const response = await request(testApp)
        .put(`/api/todos/${testTodoId}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Updates object is required');
    });

    test('should reject invalid todo ID', async () => {
      const updates = { description: 'Updated description' };

      const response = await request(testApp)
        .put('/api/todos/')
        .send(updates)
        .expect(404); // Express returns 404 for missing route parameter
    });
  });

  describe('DELETE /api/todos/:id', () => {
    let testTodoId;

    beforeEach(async () => {
      // Create a test todo first
      const response = await request(testApp)
        .post('/api/todos')
        .send({ description: 'Test todo for deletion' });
      testTodoId = response.body.data.id;
    });

    test('should delete existing todo', async () => {
      const response = await request(testApp)
        .delete(`/api/todos/${testTodoId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Todo deleted successfully');

      // Verify todo is actually deleted
      const getResponse = await request(testApp)
        .get('/api/todos')
        .expect(200);
      
      expect(getResponse.body.data).toHaveLength(0);
    });

    test('should return 404 for non-existent todo', async () => {
      const response = await request(testApp)
        .delete('/api/todos/non-existent-id')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Todo not found');
    });

    test('should reject invalid todo ID', async () => {
      const response = await request(testApp)
        .delete('/api/todos/')
        .expect(404); // Express returns 404 for missing route parameter
    });
  });

  describe('API Error Handling', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(testApp)
        .post('/api/todos')
        .send('{"description": invalid}')
        .set('Content-Type', 'application/json')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/Invalid JSON/);
    });

    test('should handle large request bodies', async () => {
      const largeDescription = 'a'.repeat(15 * 1024 * 1024); // 15MB
      
      const response = await request(testApp)
        .post('/api/todos')
        .send({ description: largeDescription })
        .expect(413);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request body too large');
    });
  });
});