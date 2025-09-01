/**
 * Full Stack Integration Tests
 * Tests the complete integration between backend API and frontend application
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Import the app for testing
const { app } = require('../../server');

describe('Full Stack Integration Tests', () => {
  const TEST_DATA_FILE = path.join(__dirname, '../data/todos-integration-test.json');
  let server;

  beforeAll(() => {
    // Set test data file
    process.env.DATA_FILE = TEST_DATA_FILE;
  });

  beforeEach(async () => {
    // Clean up test data before each test
    if (fs.existsSync(TEST_DATA_FILE)) {
      fs.unlinkSync(TEST_DATA_FILE);
    }
    
    // Clear any existing todos via API
    try {
      const response = await request(app).get('/api/todos');
      if (response.body.success && response.body.data) {
        for (const todo of response.body.data) {
          await request(app).delete(`/api/todos/${todo.id}`);
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  afterEach(() => {
    // Clean up test data after each test
    if (fs.existsSync(TEST_DATA_FILE)) {
      fs.unlinkSync(TEST_DATA_FILE);
    }
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('Complete CRUD Workflow Integration', () => {
    test('should handle complete todo lifecycle through API', async () => {
      // Test 1: Create a new todo (Requirement 1.1, 1.2)
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Integration test todo' })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.description).toBe('Integration test todo');
      expect(createResponse.body.data.completed).toBe(false);
      expect(createResponse.body.data.id).toBeDefined();

      const todoId = createResponse.body.data.id;

      // Test 2: Retrieve all todos (Requirement 2.1)
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getAllResponse.body.success).toBe(true);
      expect(getAllResponse.body.data).toHaveLength(1);
      expect(getAllResponse.body.data[0].description).toBe('Integration test todo');

      // Test 3: Update todo description (Requirement 3.2)
      const updateResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ description: 'Updated integration test todo' })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.description).toBe('Updated integration test todo');

      // Test 4: Toggle completion status (Requirement 4.1, 4.2)
      const toggleResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true })
        .expect(200);

      expect(toggleResponse.body.success).toBe(true);
      expect(toggleResponse.body.data.completed).toBe(true);

      // Test 5: Verify persistence by retrieving again
      const getUpdatedResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getUpdatedResponse.body.data[0].description).toBe('Updated integration test todo');
      expect(getUpdatedResponse.body.data[0].completed).toBe(true);

      // Test 6: Delete todo (Requirement 5.1, 5.2)
      await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(200);

      // Test 7: Verify deletion
      const getFinalResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getFinalResponse.body.data.filter(t => t.id === todoId)).toHaveLength(0);
    });

    test('should handle multiple todos with different states', async () => {
      // Create multiple todos
      const todo1Response = await request(app)
        .post('/api/todos')
        .send({ description: 'First todo' })
        .expect(201);

      const todo2Response = await request(app)
        .post('/api/todos')
        .send({ description: 'Second todo' })
        .expect(201);

      const todo3Response = await request(app)
        .post('/api/todos')
        .send({ description: 'Third todo' })
        .expect(201);

      // Complete some todos
      await request(app)
        .put(`/api/todos/${todo1Response.body.data.id}`)
        .send({ completed: true })
        .expect(200);

      await request(app)
        .put(`/api/todos/${todo3Response.body.data.id}`)
        .send({ completed: true })
        .expect(200);

      // Verify final state
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      const createdTodos = getAllResponse.body.data.filter(todo => 
        ['First todo', 'Second todo', 'Third todo'].includes(todo.description)
      );
      expect(createdTodos).toHaveLength(3);
      
      const completedTodos = createdTodos.filter(todo => todo.completed);
      const incompleteTodos = createdTodos.filter(todo => !todo.completed);
      
      expect(completedTodos).toHaveLength(2);
      expect(incompleteTodos).toHaveLength(1);
      expect(incompleteTodos[0].description).toBe('Second todo');
    });
  });

  describe('Data Persistence Integration', () => {
    test('should persist data across server restarts', async () => {
      // Create initial data
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Persistent todo' })
        .expect(201);

      const todoId = createResponse.body.data.id;

      // Mark as completed
      await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: true })
        .expect(200);

      // Verify data exists in file
      expect(fs.existsSync(TEST_DATA_FILE)).toBe(true);
      const fileData = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
      expect(fileData).toHaveLength(1);
      expect(fileData[0].description).toBe('Persistent todo');
      expect(fileData[0].completed).toBe(true);

      // Simulate server restart by creating new app instance
      delete require.cache[require.resolve('../../server')];
      const { app: newApp } = require('../../server');

      // Verify data persisted
      const getResponse = await request(newApp)
        .get('/api/todos')
        .expect(200);

      expect(getResponse.body.data).toHaveLength(1);
      expect(getResponse.body.data[0].description).toBe('Persistent todo');
      expect(getResponse.body.data[0].completed).toBe(true);
      expect(getResponse.body.data[0].id).toBe(todoId);
    });

    test('should handle concurrent operations safely', async () => {
      // Create multiple todos concurrently
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          request(app)
            .post('/api/todos')
            .send({ description: `Concurrent todo ${i}` })
        );
      }

      const responses = await Promise.all(createPromises);
      
      // Verify all were created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all todos exist
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      const concurrentTodos = getAllResponse.body.data.filter(todo => 
        todo.description.startsWith('Concurrent todo')
      );
      expect(concurrentTodos).toHaveLength(5);

      // Perform concurrent updates
      const todoIds = responses.map(r => r.body.data.id);
      const updatePromises = todoIds.map((id, index) =>
        request(app)
          .put(`/api/todos/${id}`)
          .send({ completed: index % 2 === 0 })
      );

      const updateResponses = await Promise.all(updatePromises);
      
      // Verify all updates succeeded
      updateResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify final state
      const finalResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      const finalConcurrentTodos = finalResponse.body.data.filter(todo => 
        todo.description.startsWith('Concurrent todo')
      );
      const completedCount = finalConcurrentTodos.filter(todo => todo.completed).length;
      const incompleteCount = finalConcurrentTodos.filter(todo => !todo.completed).length;
      
      expect(completedCount).toBe(3); // indices 0, 2, 4
      expect(incompleteCount).toBe(2); // indices 1, 3
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle validation errors consistently', async () => {
      // Test empty description (Requirement 1.3)
      const emptyResponse = await request(app)
        .post('/api/todos')
        .send({ description: '' })
        .expect(400);

      expect(emptyResponse.body.success).toBe(false);
      expect(emptyResponse.body.error).toContain('cannot be empty');

      // Test missing description
      const missingResponse = await request(app)
        .post('/api/todos')
        .send({})
        .expect(400);

      expect(missingResponse.body.success).toBe(false);
      expect(missingResponse.body.error).toContain('required');

      // Test empty update (Requirement 3.4)
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Valid todo' })
        .expect(201);

      const todoId = createResponse.body.data.id;

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

      const validTodo = getResponse.body.data.find(todo => todo.id === todoId);
      expect(validTodo.description).toBe('Valid todo');
    });

    test('should handle non-existent todo operations', async () => {
      const nonExistentId = 'non-existent-id';

      // Test update non-existent todo
      const updateResponse = await request(app)
        .put(`/api/todos/${nonExistentId}`)
        .send({ description: 'Updated' })
        .expect(404);

      expect(updateResponse.body.success).toBe(false);
      expect(updateResponse.body.error).toContain('not found');

      // Test delete non-existent todo
      const deleteResponse = await request(app)
        .delete(`/api/todos/${nonExistentId}`)
        .expect(404);

      expect(deleteResponse.body.success).toBe(false);
      expect(deleteResponse.body.error).toContain('not found');
    });

    test('should handle malformed requests gracefully', async () => {
      // Test invalid JSON structure
      const invalidResponse = await request(app)
        .post('/api/todos')
        .send({ invalid: 'field', description: 123 })
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);

      // Test invalid completed value
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Test todo' })
        .expect(201);

      const todoId = createResponse.body.data.id;

      const invalidUpdateResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ completed: 'invalid' })
        .expect(400);

      expect(invalidUpdateResponse.body.success).toBe(false);
    });
  });

  describe('API Response Format Consistency', () => {
    test('should maintain consistent response format across all endpoints', async () => {
      // Create todo
      const createResponse = await request(app)
        .post('/api/todos')
        .send({ description: 'Format test todo' })
        .expect(201);

      // Verify create response format
      expect(createResponse.body).toHaveProperty('success', true);
      expect(createResponse.body).toHaveProperty('data');
      expect(createResponse.body.data).toHaveProperty('id');
      expect(createResponse.body.data).toHaveProperty('description');
      expect(createResponse.body.data).toHaveProperty('completed');
      expect(createResponse.body.data).toHaveProperty('createdAt');
      expect(createResponse.body.data).toHaveProperty('updatedAt');

      const todoId = createResponse.body.data.id;

      // Verify get all response format
      const getAllResponse = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(getAllResponse.body).toHaveProperty('success', true);
      expect(getAllResponse.body).toHaveProperty('data');
      expect(Array.isArray(getAllResponse.body.data)).toBe(true);

      // Verify update response format
      const updateResponse = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ description: 'Updated format test' })
        .expect(200);

      expect(updateResponse.body).toHaveProperty('success', true);
      expect(updateResponse.body).toHaveProperty('data');
      expect(updateResponse.body.data).toHaveProperty('updatedAt');

      // Verify delete response format
      const deleteResponse = await request(app)
        .delete(`/api/todos/${todoId}`)
        .expect(200);

      expect(deleteResponse.body).toHaveProperty('success', true);
      expect(deleteResponse.body).toHaveProperty('message');

      // Verify error response format
      const errorResponse = await request(app)
        .post('/api/todos')
        .send({ description: '' })
        .expect(400);

      expect(errorResponse.body).toHaveProperty('success', false);
      expect(errorResponse.body).toHaveProperty('error');
    });
  });

  describe('Static File Serving Integration', () => {
    test('should serve frontend files correctly', async () => {
      // Test HTML file
      const htmlResponse = await request(app)
        .get('/')
        .expect(200);

      expect(htmlResponse.headers['content-type']).toContain('text/html');
      expect(htmlResponse.text).toContain('Todo App');

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

    test('should handle 404 for non-existent static files', async () => {
      const response = await request(app)
        .get('/non-existent-file.js');
      
      // Should return index.html for non-API routes (SPA behavior)
      expect(response.status).toBe(200);
      expect(response.text).toContain('Todo App');
    });
  });

  describe('CORS Integration', () => {
    test('should include proper CORS headers', async () => {
      const response = await request(app)
        .get('/api/todos')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/todos')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });
});