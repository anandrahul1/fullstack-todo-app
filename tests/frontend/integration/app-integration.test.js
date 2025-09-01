/**
 * Frontend Integration Tests
 * Tests the frontend JavaScript application logic and API integration
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Frontend Application Integration Tests', () => {
  let dom;
  let window;
  let document;
  let app;

  beforeEach(() => {
    // Reset fetch mock
    fetch.mockClear();

    // Create DOM environment
    const htmlContent = fs.readFileSync(path.join(__dirname, '../../../public/index.html'), 'utf8');
    dom = new JSDOM(htmlContent, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.alert = jest.fn();
    global.confirm = jest.fn();

    // Load the application JavaScript
    const appJs = fs.readFileSync(path.join(__dirname, '../../../public/js/app.js'), 'utf8');
    
    // Execute the app code in the DOM context
    const script = document.createElement('script');
    script.textContent = appJs;
    document.head.appendChild(script);

    // Get reference to the app object
    app = window.TodoApp;
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Application Initialization', () => {
    test('should initialize app and load todos on startup', async () => {
      // Mock successful API response
      const mockTodos = [
        { id: '1', description: 'Test todo 1', completed: false, createdAt: new Date().toISOString() },
        { id: '2', description: 'Test todo 2', completed: true, createdAt: new Date().toISOString() }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTodos })
      });

      // Initialize app
      await app.init();

      // Verify API was called
      expect(fetch).toHaveBeenCalledWith('/api/todos');

      // Verify todos are rendered in DOM
      const todoItems = document.querySelectorAll('.todo-item');
      expect(todoItems.length).toBe(2);

      // Verify todo content
      const descriptions = Array.from(document.querySelectorAll('.todo-description'))
        .map(el => el.textContent);
      expect(descriptions).toContain('Test todo 1');
      expect(descriptions).toContain('Test todo 2');
    });

    test('should handle API error during initialization', async () => {
      // Mock API error
      fetch.mockRejectedValueOnce(new Error('Network error'));

      // Initialize app
      await app.init();

      // Verify error message is displayed
      const errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('error');
    });

    test('should show empty state when no todos exist', async () => {
      // Mock empty response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      await app.init();

      // Verify empty state is shown
      const emptyState = document.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.style.display).not.toBe('none');
    });
  });

  describe('Todo Creation Integration', () => {
    beforeEach(async () => {
      // Initialize with empty state
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
      await app.init();
      fetch.mockClear();
    });

    test('should create todo and update UI on successful API call', async () => {
      const newTodo = {
        id: '123',
        description: 'New test todo',
        completed: false,
        createdAt: new Date().toISOString()
      };

      // Mock successful creation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: newTodo })
      });

      // Fill form and submit
      const input = document.getElementById('todo-input');
      const button = document.getElementById('add-todo-btn');
      
      input.value = 'New test todo';
      button.click();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify API call
      expect(fetch).toHaveBeenCalledWith('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New test todo' })
      });

      // Verify UI update
      const todoItems = document.querySelectorAll('.todo-item');
      expect(todoItems.length).toBe(1);
      
      const description = document.querySelector('.todo-description');
      expect(description.textContent).toBe('New test todo');

      // Verify input is cleared
      expect(input.value).toBe('');

      // Verify empty state is hidden
      const emptyState = document.querySelector('.empty-state');
      expect(emptyState.style.display).toBe('none');
    });

    test('should handle validation error for empty description', async () => {
      const input = document.getElementById('todo-input');
      const button = document.getElementById('add-todo-btn');
      
      // Try to submit empty todo
      input.value = '';
      button.click();

      // Verify no API call was made
      expect(fetch).not.toHaveBeenCalled();

      // Verify error message
      const errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('cannot be empty');
    });

    test('should handle API error during creation', async () => {
      // Mock API error
      fetch.mockRejectedValueOnce(new Error('Server error'));

      const input = document.getElementById('todo-input');
      const button = document.getElementById('add-todo-btn');
      
      input.value = 'Test todo';
      button.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify error message
      const errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('error');

      // Verify input value is preserved
      expect(input.value).toBe('Test todo');
    });
  });

  describe('Todo Update Integration', () => {
    let mockTodo;

    beforeEach(async () => {
      mockTodo = {
        id: '123',
        description: 'Original todo',
        completed: false,
        createdAt: new Date().toISOString()
      };

      // Initialize with one todo
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [mockTodo] })
      });
      await app.init();
      fetch.mockClear();
    });

    test('should toggle completion status successfully', async () => {
      const updatedTodo = { ...mockTodo, completed: true };

      // Mock successful update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedTodo })
      });

      // Click checkbox
      const checkbox = document.querySelector('.todo-checkbox');
      checkbox.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify API call
      expect(fetch).toHaveBeenCalledWith('/api/todos/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      });

      // Verify UI update
      const todoItem = document.querySelector('.todo-item');
      expect(todoItem.classList.contains('completed')).toBe(true);
      expect(checkbox.checked).toBe(true);
    });

    test('should edit todo description successfully', async () => {
      const updatedTodo = { ...mockTodo, description: 'Updated description' };

      // Mock successful update
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedTodo })
      });

      // Start editing
      const editBtn = document.querySelector('.edit-btn');
      editBtn.click();

      // Verify edit mode
      const editInput = document.querySelector('.edit-input');
      expect(editInput).toBeTruthy();
      expect(editInput.value).toBe('Original todo');

      // Update and save
      editInput.value = 'Updated description';
      const saveBtn = document.querySelector('.save-btn');
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify API call
      expect(fetch).toHaveBeenCalledWith('/api/todos/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated description' })
      });

      // Verify UI update
      const description = document.querySelector('.todo-description');
      expect(description.textContent).toBe('Updated description');
    });

    test('should handle edit cancellation', async () => {
      // Start editing
      const editBtn = document.querySelector('.edit-btn');
      editBtn.click();

      const editInput = document.querySelector('.edit-input');
      editInput.value = 'Changed but cancelled';

      // Cancel edit
      const cancelBtn = document.querySelector('.cancel-btn');
      cancelBtn.click();

      // Verify no API call
      expect(fetch).not.toHaveBeenCalled();

      // Verify original description is preserved
      const description = document.querySelector('.todo-description');
      expect(description.textContent).toBe('Original todo');
    });

    test('should handle empty description validation during edit', async () => {
      // Start editing
      const editBtn = document.querySelector('.edit-btn');
      editBtn.click();

      const editInput = document.querySelector('.edit-input');
      editInput.value = '';

      const saveBtn = document.querySelector('.save-btn');
      saveBtn.click();

      // Verify no API call
      expect(fetch).not.toHaveBeenCalled();

      // Verify error message
      const errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('cannot be empty');

      // Verify original description is preserved
      const description = document.querySelector('.todo-description');
      expect(description.textContent).toBe('Original todo');
    });
  });

  describe('Todo Deletion Integration', () => {
    let mockTodo;

    beforeEach(async () => {
      mockTodo = {
        id: '123',
        description: 'Todo to delete',
        completed: false,
        createdAt: new Date().toISOString()
      };

      // Initialize with one todo
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [mockTodo] })
      });
      await app.init();
      fetch.mockClear();
    });

    test('should delete todo successfully with confirmation', async () => {
      // Mock confirmation
      global.confirm.mockReturnValueOnce(true);

      // Mock successful deletion
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      // Click delete button
      const deleteBtn = document.querySelector('.delete-btn');
      deleteBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify confirmation was shown
      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('delete')
      );

      // Verify API call
      expect(fetch).toHaveBeenCalledWith('/api/todos/123', {
        method: 'DELETE'
      });

      // Verify todo is removed from UI
      const todoItems = document.querySelectorAll('.todo-item');
      expect(todoItems.length).toBe(0);

      // Verify empty state is shown
      const emptyState = document.querySelector('.empty-state');
      expect(emptyState.style.display).not.toBe('none');
    });

    test('should cancel deletion when user declines confirmation', async () => {
      // Mock declined confirmation
      global.confirm.mockReturnValueOnce(false);

      const deleteBtn = document.querySelector('.delete-btn');
      deleteBtn.click();

      // Verify no API call
      expect(fetch).not.toHaveBeenCalled();

      // Verify todo is still in UI
      const todoItems = document.querySelectorAll('.todo-item');
      expect(todoItems.length).toBe(1);
    });

    test('should handle deletion API error', async () => {
      global.confirm.mockReturnValueOnce(true);
      fetch.mockRejectedValueOnce(new Error('Delete failed'));

      const deleteBtn = document.querySelector('.delete-btn');
      deleteBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify error message
      const errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('error');

      // Verify todo is still in UI (deletion failed)
      const todoItems = document.querySelectorAll('.todo-item');
      expect(todoItems.length).toBe(1);
    });
  });

  describe('Error Recovery and User Feedback', () => {
    test('should clear error messages after successful operations', async () => {
      // Initialize with empty state
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
      await app.init();
      fetch.mockClear();

      // Trigger validation error
      const button = document.getElementById('add-todo-btn');
      button.click();

      let errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();

      // Now perform successful operation
      const newTodo = {
        id: '123',
        description: 'Success todo',
        completed: false,
        createdAt: new Date().toISOString()
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: newTodo })
      });

      const input = document.getElementById('todo-input');
      input.value = 'Success todo';
      button.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify error message is cleared
      errorMessage = document.querySelector('.error-message');
      expect(errorMessage).toBeFalsy();
    });

    test('should provide loading feedback during operations', async () => {
      // Initialize with empty state
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
      await app.init();
      fetch.mockClear();

      // Mock slow API response
      let resolvePromise;
      const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      fetch.mockReturnValueOnce(slowPromise);

      const input = document.getElementById('todo-input');
      const button = document.getElementById('add-todo-btn');
      
      input.value = 'Loading test';
      button.click();

      // Check for loading state
      const loadingElement = document.querySelector('.loading');
      expect(loadingElement).toBeTruthy();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: '123', description: 'Loading test', completed: false }
        })
      });

      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify loading state is removed
      const loadingAfter = document.querySelector('.loading');
      expect(loadingAfter).toBeFalsy();
    });
  });
});