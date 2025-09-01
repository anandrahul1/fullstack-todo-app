/**
 * Simple End-to-End Workflow Test
 * Tests core user workflows without browser automation
 */

const request = require('supertest');
const { app } = require('../../server');
const fs = require('fs');
const path = require('path');

describe('Simple End-to-End Workflow Tests', () => {
  const TEST_DATA_FILE = path.join(__dirname, '../data/todos-simple-e2e.json');

  beforeAll(() => {
    // Set test data file
    process.env.DATA_FILE = TEST_DATA_FILE;
  });

  beforeEach(() => {
    // Clean up test data before each test
    if (fs.existsSync(TEST_DATA_FILE)) {
      fs.unlinkSync(TEST_DATA_FILE);
    }
  });

  afterEach(() => {
    // Clean up test data after each test
    if (fs.existsSync(TEST_DATA_FILE)) {
      fs.unlinkSync(TEST_DATA_FILE);
    }
  });

  describe('Complete User Workflow Simulation', () => {
    test('should complete full CRUD workflow (Requirements 1.1, 1.2, 2.1, 3.1, 4.1, 5.1)', async () => {
      // Step 1: User loads the application
      const indexResponse = await request(app)
        .get('/')
        .expect(200);
      
      expect(indexResponse.text).toContain('Todo App');
      expect(indexResponse.text).toContain('todo-input');
      expect(indexResponse.text).toContain('add-todo-btn');

      // Step 2: User creates a new todo (Requirement 1.1, 1.2)
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Complete project documentation' })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.description).toBe('Complete project documentation');
      expect(createResponse.body.data.completed).toBe(false); // Requirement 1.4
      expect(createResponse.body.data.id).toBeDefined();

      const todoId = createResponse.body.data.id;

      // Step 3: User views all todos (Requirement 2.1)
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getAllResponse.body.success).toBe(true);
      expect(getAllResponse.body.data).toHaveLength(1);
      expect(getAllResponse.body.data[0].description).toBe('Complete project documentation');

      // Step 4: User edits the todo (Requirement 3.1, 3.2)
      const updateResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ description: 'Complete project documentation and tests' })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.description).toBe('Complete project documentation and tests');

      // Step 5: User marks todo as complete (Requirement 4.1, 4.2)
      const completeResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);
      expect(completeResponse.body.data.completed).toBe(true);

      // Step 6: User verifies the changes persisted
      const verifyResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(verifyResponse.body.data[0].description).toBe('Complete project documentation and tests');
      expect(verifyResponse.body.data[0].completed).toBe(true);

      // Step 7: User deletes the todo (Requirement 5.1, 5.2)
      await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(200);

      // Step 8: User verifies todo was deleted
      const finalResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(finalResponse.body.data).toHaveLength(0);
    });

    test('should handle validation errors gracefully (Requirements 1.3, 3.4)', async () => {
      // Test empty todo creation (Requirement 1.3)
      const emptyCreateResponse = await request(app)
        .post('/api/todos')
        .send({ description: '' })
        .expect(400);

      expect(emptyCreateResponse.body.success).toBe(false);
      expect(emptyCreateResponse.body.error).toContain('cannot be empty');

      // Create a valid todo first
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Valid todo' })
        .expect(201);

      const todoId = createResponse.body.data.id;

      // Test empty todo update (Requirement 3.4)
      const emptyUpdateResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ description: '' })
        .expect(400);

      expect(emptyUpdateResponse.body.success).toBe(false);
      expect(emptyUpdateResponse.body.error).toContain('cannot be empty');

      // Verify original todo is unchanged
      const getResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getResponse.body.data[0].description).toBe('Valid todo');
    });

    test('should persist data across operations (Requirements 7.1, 7.2)', async () => {
      // Create multiple todos with different states
      const todo1Response = await request(app)
        .post('/api/todos')
        .send({ description: 'First persistent todo' })
        .expect(201);

      const todo2Response = await request(app)
        .post('/api/todos')
        .send({ description: 'Second persistent todo' })
        .expect(201);

      // Mark one as completed
      await request(app)
        .put(`/api/todos/${todo1Response.body.data.id}`)
        .send({ completed: true })
        .expect(200);

      // Verify data exists in file (Requirement 7.1)
      expect(fs.existsSync(TEST_DATA_FILE)).toBe(true);
      const fileData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
      expect(fileData).toHaveLength(2);

      // Verify data can be loaded (Requirement 7.2)
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getAllResponse.body.data).toHaveLength(2);
      
      const completedTodos = getAllResponse.body.data.filter(todo => todo.completed);
      const incompleteTodos = getAllResponse.body.data.filter(todo => !todo.completed);
      
      expect(completedTodos).toHaveLength(1);
      expect(incompleteTodos).toHaveLength(1);
      expect(completedTodos[0].description).toBe('First persistent todo');
    });

    test('should handle multiple todos workflow (Requirements 2.2, 2.3, 2.4)', async () => {
      // Test empty state message (Requirement 2.4)
      const emptyResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(emptyResponse.body.data).toHaveLength(0);

      // Create multiple todos
      const todoDescriptions = [
        'Learn JavaScript',
        'Build Todo App',
        'Write Tests',
        'Deploy Application'
      ];

      const createdTodos = [];
      for (const description of todoDescriptions) {
        const response = await request(app)
          .post('/api/todos')
          .send({ description })
          .expect(201);
        createdTodos.push(response.body.data);
      }

      // Mark some as completed
      await request(app)
        .put(`/api/todos/${createdTodos[0].id}`)
        .send({ completed: true })
        .expect(200);

      await request(app)
        .put(`/api/todos/${createdTodos[2].id}`)
        .send({ completed: true })
        .expect(200);

      // Verify all todos are displayed with correct information (Requirement 2.2, 2.3)
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getAllResponse.body.data).toHaveLength(4);

      // Verify each todo has required fields
      getAllResponse.body.data.forEach(todo => {
        expect(todo).toHaveProperty('id');
        expect(todo).toHaveProperty('description');
        expect(todo).toHaveProperty('completed');
        expect(todo).toHaveProperty('createdAt');
        expect(todo).toHaveProperty('updatedAt');
      });

      // Verify completion states
      const completed = getAllResponse.body.data.filter(todo => todo.completed);
      const incomplete = getAllResponse.body.data.filter(todo => !todo.completed);

      expect(completed).toHaveLength(2);
      expect(incomplete).toHaveLength(2);

      // Verify specific todos are completed
      const completedDescriptions = completed.map(todo => todo.description);
      expect(completedDescriptions).toContain('Learn JavaScript');
      expect(completedDescriptions).toContain('Write Tests');
    });

    test('should handle error scenarios gracefully (Requirements 6.5, 7.4)', async () => {
      // Test non-existent todo operations
      const nonExistentId = 'non-existent-id';

      const updateResponse = await request(app)
        .put(`/api/todos/${nonExistentId}`)
        .send({ description: 'Updated' })
        .expect(404);

      expect(updateResponse.body.success).toBe(false);
      expect(updateResponse.body.error).toContain('not found');

      const deleteResponse = await request(app)
        .delete(`/api/todos/${nonExistentId}`)
        .expect(404);

      expect(deleteResponse.body.success).toBe(false);
      expect(deleteResponse.body.error).toContain('not found');

      // Test malformed requests
      const malformedResponse = await request(app)
        .post('/api/todos')
        .send({ description: 123 })
        .expect(400);

      expect(malformedResponse.body.success).toBe(false);
    });
  });

  describe('API Consistency and Frontend Integration', () => {
    test('should maintain consistent API response format', async () => {
      // Test create response format
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Format test' })
        .expect(201);

      expect(createResponse.body).toHaveProperty('success', true);
      expect(createResponse.body).toHaveProperty('data');
      expect(createResponse.body.data).toHaveProperty('id');
      expect(createResponse.body.data).toHaveProperty('description');
      expect(createResponse.body.data).toHaveProperty('completed');
      expect(createResponse.body.data).toHaveProperty('createdAt');
      expect(createResponse.body.data).toHaveProperty('updatedAt');

      // Test get all response format
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getAllResponse.body).toHaveProperty('success', true);
      expect(getAllResponse.body).toHaveProperty('data');
      expect(Array.isArray(getAllResponse.body.data)).toBe(true);

      // Test error response format
      const errorResponse = await request(app)
        .post('/api/todos')
        .send({ description: '' })
        .expect(400);

      expect(errorResponse.body).toHaveProperty('success', false);
      expect(errorResponse.body).toHaveProperty('error');
    });

    test('should serve frontend assets correctly', async () => {
      // Test main HTML file
      const htmlResponse = await request(app)
        .get('/')
        .expect(200);

      expect(htmlResponse.headers['content-type']).toContain('text/html');
      expect(htmlResponse.text).toContain('Todo App');
      expect(htmlResponse.text).toContain('todo-input');

      // Test CSS file
      const cssResponse = await request(app)
        .get('/css/styles.css')
        .expect(200);

      expect(cssResponse.headers['content-type']).toContain('text/css');

      // Test JavaScript file
      const jsResponse = await request(app)
        .get('/js/app.js')
        .expect(200);

      expect(jsResponse.headers['content-type']).toContain('application/javascript');
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();

      const optionsResponse = await request(app)
        .options('/api/todos')
        .expect(204);

      expect(optionsResponse.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});