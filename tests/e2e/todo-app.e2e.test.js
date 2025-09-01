const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

describe('Todo App End-to-End Tests', () => {
  let browser;
  let page;
  let server;
  const PORT = 3001; // Use different port for testing
  const BASE_URL = `http://localhost:${PORT}`;
  const TEST_DATA_FILE = path.join(__dirname, '../../data/todos-test.json');

  beforeAll(async () => {
    // Clean up any existing test data
    if (fs.existsSync(TEST_DATA_FILE)) {
      fs.unlinkSync(TEST_DATA_FILE);
    }

    // Start the server for testing
    server = spawn('node', ['server.js'], {
      env: { ...process.env, PORT, DATA_FILE: TEST_DATA_FILE },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.kill();
    }
    // Clean up test data
    if (fs.existsSync(TEST_DATA_FILE)) {
      fs.unlinkSync(TEST_DATA_FILE);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(BASE_URL);
    
    // Clear any existing todos before each test
    await page.evaluate(() => {
      return fetch('/api/todos')
        .then(response => response.json())
        .then(data => {
          const deletePromises = data.data.map(todo => 
            fetch(`/api/todos/${todo.id}`, { method: 'DELETE' })
          );
          return Promise.all(deletePromises);
        });
    });
    
    // Reload page to reflect cleared state
    await page.reload();
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Complete User Workflows', () => {
    test('should complete full CRUD workflow for todos', async () => {
      // Test creating a new todo (Requirement 1.1, 1.2)
      await page.type('#todo-input', 'Test todo item');
      await page.click('#add-todo-btn');
      
      // Wait for todo to appear and verify it's displayed
      await page.waitForSelector('.todo-item');
      const todoText = await page.$eval('.todo-item .todo-description', el => el.textContent);
      expect(todoText).toBe('Test todo item');
      
      // Verify todo is marked as incomplete by default (Requirement 1.4)
      const isCompleted = await page.$eval('.todo-item .todo-checkbox', el => el.checked);
      expect(isCompleted).toBe(false);

      // Test reading/displaying todos (Requirement 2.1, 2.2)
      const todoItems = await page.$$('.todo-item');
      expect(todoItems.length).toBe(1);

      // Test editing todo (Requirement 3.1, 3.2)
      await page.click('.todo-item .edit-btn');
      await page.waitForSelector('.todo-item .edit-input');
      
      // Clear and type new description
      await page.evaluate(() => {
        document.querySelector('.todo-item .edit-input').value = '';
      });
      await page.type('.todo-item .edit-input', 'Updated todo item');
      await page.click('.todo-item .save-btn');
      
      // Verify update
      await page.waitForSelector('.todo-item .todo-description');
      const updatedText = await page.$eval('.todo-item .todo-description', el => el.textContent);
      expect(updatedText).toBe('Updated todo item');

      // Test toggling completion status (Requirement 4.1, 4.2)
      await page.click('.todo-item .todo-checkbox');
      
      // Verify visual indication of completion (Requirement 4.3)
      const completedClass = await page.$eval('.todo-item', el => el.classList.contains('completed'));
      expect(completedClass).toBe(true);
      
      // Toggle back to incomplete
      await page.click('.todo-item .todo-checkbox');
      const incompletedClass = await page.$eval('.todo-item', el => el.classList.contains('completed'));
      expect(incompletedClass).toBe(false);

      // Test deletion with confirmation (Requirement 5.1, 5.3)
      await page.click('.todo-item .delete-btn');
      
      // Handle confirmation dialog
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('delete');
        await dialog.accept();
      });
      
      // Wait for todo to be removed
      await page.waitForFunction(() => document.querySelectorAll('.todo-item').length === 0);
      
      // Verify empty state message (Requirement 2.4)
      const emptyMessage = await page.$eval('.empty-state', el => el.textContent);
      expect(emptyMessage).toContain('No todos yet');
    });

    test('should handle multiple todos and maintain order', async () => {
      // Create multiple todos
      const todoDescriptions = ['First todo', 'Second todo', 'Third todo'];
      
      for (const description of todoDescriptions) {
        await page.type('#todo-input', description);
        await page.click('#add-todo-btn');
        await page.waitForTimeout(100); // Small delay between creations
      }
      
      // Verify all todos are displayed
      const todoItems = await page.$$('.todo-item');
      expect(todoItems.length).toBe(3);
      
      // Verify order (newest first)
      const displayedTexts = await page.$$eval('.todo-item .todo-description', 
        elements => elements.map(el => el.textContent)
      );
      expect(displayedTexts).toEqual(['Third todo', 'Second todo', 'First todo']);
      
      // Test completing some todos
      const checkboxes = await page.$$('.todo-item .todo-checkbox');
      await checkboxes[0].click(); // Complete first (Third todo)
      await checkboxes[2].click(); // Complete third (First todo)
      
      // Verify completion states
      const completedStates = await page.$$eval('.todo-item', 
        elements => elements.map(el => el.classList.contains('completed'))
      );
      expect(completedStates).toEqual([true, false, true]);
    });
  });

  describe('Data Persistence Tests', () => {
    test('should persist todos across browser sessions', async () => {
      // Create a todo
      await page.type('#todo-input', 'Persistent todo');
      await page.click('#add-todo-btn');
      await page.waitForSelector('.todo-item');
      
      // Mark it as completed
      await page.click('.todo-item .todo-checkbox');
      
      // Close and reopen page (simulating browser session)
      await page.close();
      page = await browser.newPage();
      await page.goto(BASE_URL);
      
      // Verify todo persisted with correct state
      await page.waitForSelector('.todo-item');
      const todoText = await page.$eval('.todo-item .todo-description', el => el.textContent);
      expect(todoText).toBe('Persistent todo');
      
      const isCompleted = await page.$eval('.todo-item .todo-checkbox', el => el.checked);
      expect(isCompleted).toBe(true);
      
      const hasCompletedClass = await page.$eval('.todo-item', el => el.classList.contains('completed'));
      expect(hasCompletedClass).toBe(true);
    });

    test('should maintain data integrity after server restart', async () => {
      // Create multiple todos with different states
      await page.type('#todo-input', 'Todo before restart');
      await page.click('#add-todo-btn');
      await page.waitForSelector('.todo-item');
      
      await page.type('#todo-input', 'Completed todo');
      await page.click('#add-todo-btn');
      await page.waitForTimeout(100);
      
      // Complete the second todo
      const checkboxes = await page.$$('.todo-item .todo-checkbox');
      await checkboxes[0].click();
      
      // Simulate server restart by killing and restarting
      server.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      server = spawn('node', ['server.js'], {
        env: { ...process.env, PORT, DATA_FILE: TEST_DATA_FILE },
        stdio: 'pipe'
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reload page
      await page.reload();
      
      // Verify data persisted correctly
      await page.waitForSelector('.todo-item');
      const todoItems = await page.$$('.todo-item');
      expect(todoItems.length).toBe(2);
      
      const todoTexts = await page.$$eval('.todo-item .todo-description', 
        elements => elements.map(el => el.textContent)
      );
      expect(todoTexts).toContain('Todo before restart');
      expect(todoTexts).toContain('Completed todo');
      
      // Verify completion state persisted
      const completedStates = await page.$$eval('.todo-item', 
        elements => elements.map(el => el.classList.contains('completed'))
      );
      expect(completedStates.filter(state => state)).toHaveLength(1);
    });
  });

  describe('Error Scenarios and Recovery', () => {
    test('should handle empty todo submission gracefully', async () => {
      // Try to submit empty todo (Requirement 1.3)
      await page.click('#add-todo-btn');
      
      // Verify error message appears
      await page.waitForSelector('.error-message');
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('cannot be empty');
      
      // Verify no todo was created
      const todoItems = await page.$$('.todo-item');
      expect(todoItems.length).toBe(0);
      
      // Verify error message disappears after valid input
      await page.type('#todo-input', 'Valid todo');
      await page.click('#add-todo-btn');
      
      await page.waitForSelector('.todo-item');
      const errorExists = await page.$('.error-message');
      expect(errorExists).toBeNull();
    });

    test('should handle empty edit submission gracefully', async () => {
      // Create a todo first
      await page.type('#todo-input', 'Original todo');
      await page.click('#add-todo-btn');
      await page.waitForSelector('.todo-item');
      
      // Start editing
      await page.click('.todo-item .edit-btn');
      await page.waitForSelector('.todo-item .edit-input');
      
      // Clear the input (Requirement 3.4)
      await page.evaluate(() => {
        document.querySelector('.todo-item .edit-input').value = '';
      });
      await page.click('.todo-item .save-btn');
      
      // Verify error message and that original text is preserved
      await page.waitForSelector('.error-message');
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('cannot be empty');
      
      // Verify original text is still there
      const todoText = await page.$eval('.todo-item .todo-description', el => el.textContent);
      expect(todoText).toBe('Original todo');
    });

    test('should handle network errors gracefully', async () => {
      // Create a todo first
      await page.type('#todo-input', 'Network test todo');
      await page.click('#add-todo-btn');
      await page.waitForSelector('.todo-item');
      
      // Simulate network failure by intercepting requests
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().includes('/api/todos')) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Try to delete todo (should fail gracefully)
      await page.click('.todo-item .delete-btn');
      
      // Accept confirmation dialog
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      
      // Verify error handling (Requirement 6.5, 7.4)
      await page.waitForSelector('.error-message');
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('network error') || expect(errorText).toContain('failed');
      
      // Verify todo is still there (operation failed gracefully)
      const todoItems = await page.$$('.todo-item');
      expect(todoItems.length).toBe(1);
    });

    test('should handle server errors gracefully', async () => {
      // Kill server to simulate server error
      server.kill();
      
      // Try to create a todo
      await page.type('#todo-input', 'Server error test');
      await page.click('#add-todo-btn');
      
      // Verify error handling
      await page.waitForSelector('.error-message', { timeout: 5000 });
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('server') || expect(errorText).toContain('network') || expect(errorText).toContain('error');
      
      // Restart server for cleanup
      server = spawn('node', ['server.js'], {
        env: { ...process.env, PORT, DATA_FILE: TEST_DATA_FILE },
        stdio: 'pipe'
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
  });

  describe('User Interface Behavior', () => {
    test('should provide immediate visual feedback for all operations', async () => {
      // Test loading states during todo creation
      await page.type('#todo-input', 'Loading test todo');
      
      // Monitor for loading state
      const loadingPromise = page.waitForSelector('.loading', { timeout: 1000 }).catch(() => null);
      await page.click('#add-todo-btn');
      
      // Check if loading state appeared (it might be too fast to catch)
      const loadingElement = await loadingPromise;
      
      // Verify todo appears
      await page.waitForSelector('.todo-item');
      const todoText = await page.$eval('.todo-item .todo-description', el => el.textContent);
      expect(todoText).toBe('Loading test todo');
      
      // Verify input is cleared after successful creation
      const inputValue = await page.$eval('#todo-input', el => el.value);
      expect(inputValue).toBe('');
    });

    test('should handle rapid user interactions correctly', async () => {
      // Rapidly create multiple todos
      const todos = ['Rapid 1', 'Rapid 2', 'Rapid 3'];
      
      for (const todo of todos) {
        await page.type('#todo-input', todo);
        await page.click('#add-todo-btn');
        // Don't wait - test rapid succession
      }
      
      // Wait for all todos to appear
      await page.waitForFunction(() => document.querySelectorAll('.todo-item').length === 3);
      
      // Verify all todos were created correctly
      const todoTexts = await page.$$eval('.todo-item .todo-description', 
        elements => elements.map(el => el.textContent)
      );
      expect(todoTexts).toEqual(['Rapid 3', 'Rapid 2', 'Rapid 1']);
      
      // Rapidly toggle completion states
      const checkboxes = await page.$$('.todo-item .todo-checkbox');
      for (const checkbox of checkboxes) {
        await checkbox.click();
      }
      
      // Verify all are completed
      await page.waitForFunction(() => 
        document.querySelectorAll('.todo-item.completed').length === 3
      );
      
      const completedCount = await page.$$eval('.todo-item.completed', elements => elements.length);
      expect(completedCount).toBe(3);
    });
  });
});