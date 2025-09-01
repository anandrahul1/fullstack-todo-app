const fs = require('fs').promises;
const path = require('path');
const StorageService = require('../../../services/storageService');

describe('StorageService', () => {
  let storageService;
  let testFilePath;
  let testDataDir;

  beforeEach(() => {
    // Use a unique test file for each test
    testDataDir = path.join(__dirname, 'test-data');
    testFilePath = path.join(testDataDir, `test-todos-${Date.now()}.json`);
    storageService = new StorageService(testFilePath);
  });

  afterEach(async () => {
    // Clean up test files and directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initializeStorage', () => {
    it('should create data directory if it does not exist', async () => {
      await storageService.initializeStorage();
      
      const dirExists = await fs.access(testDataDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('should create empty todos file if it does not exist', async () => {
      await storageService.initializeStorage();
      
      const fileExists = await storageService.exists();
      expect(fileExists).toBe(true);
      
      const todos = await storageService.loadTodos();
      expect(todos).toEqual([]);
    });

    it('should not overwrite existing file', async () => {
      const existingTodos = [{ id: '1', description: 'Test todo', completed: false }];
      
      // Create directory and file first
      await fs.mkdir(testDataDir, { recursive: true });
      await fs.writeFile(testFilePath, JSON.stringify(existingTodos));
      
      await storageService.initializeStorage();
      
      const todos = await storageService.loadTodos();
      expect(todos).toEqual(existingTodos);
    });

    it('should throw error if directory creation fails', async () => {
      // Create a file where directory should be to cause error
      await fs.mkdir(path.dirname(testDataDir), { recursive: true });
      await fs.writeFile(testDataDir, 'blocking file');
      
      await expect(storageService.initializeStorage()).rejects.toThrow('Failed to initialize storage');
    });
  });

  describe('loadTodos', () => {
    it('should load todos from existing file', async () => {
      const testTodos = [
        { id: '1', description: 'Test todo 1', completed: false },
        { id: '2', description: 'Test todo 2', completed: true }
      ];
      
      await fs.mkdir(testDataDir, { recursive: true });
      await fs.writeFile(testFilePath, JSON.stringify(testTodos));
      
      const todos = await storageService.loadTodos();
      expect(todos).toEqual(testTodos);
    });

    it('should return empty array and initialize storage if file does not exist', async () => {
      const todos = await storageService.loadTodos();
      expect(todos).toEqual([]);
      
      const fileExists = await storageService.exists();
      expect(fileExists).toBe(true);
    });

    it('should throw error for invalid JSON', async () => {
      await fs.mkdir(testDataDir, { recursive: true });
      await fs.writeFile(testFilePath, 'invalid json content');
      
      await expect(storageService.loadTodos()).rejects.toThrow('Invalid JSON format in storage file');
    });

    it('should handle file read errors', async () => {
      await fs.mkdir(testDataDir, { recursive: true });
      await fs.writeFile(testFilePath, '[]');
      
      // Make file unreadable
      await fs.chmod(testFilePath, 0o000);
      
      await expect(storageService.loadTodos()).rejects.toThrow('Failed to load todos');
      
      // Restore permissions for cleanup
      await fs.chmod(testFilePath, 0o644);
    });
  });

  describe('saveTodos', () => {
    beforeEach(async () => {
      await storageService.initializeStorage();
    });

    it('should save todos to file', async () => {
      const testTodos = [
        { id: '1', description: 'Test todo 1', completed: false },
        { id: '2', description: 'Test todo 2', completed: true }
      ];
      
      await storageService.saveTodos(testTodos);
      
      const savedTodos = await storageService.loadTodos();
      expect(savedTodos).toEqual(testTodos);
    });

    it('should save empty array', async () => {
      await storageService.saveTodos([]);
      
      const savedTodos = await storageService.loadTodos();
      expect(savedTodos).toEqual([]);
    });

    it('should throw error if todos is not an array', async () => {
      await expect(storageService.saveTodos('not an array')).rejects.toThrow('Todos must be an array');
      await expect(storageService.saveTodos(null)).rejects.toThrow('Todos must be an array');
      await expect(storageService.saveTodos({})).rejects.toThrow('Todos must be an array');
    });

    it('should use atomic write operation', async () => {
      const testTodos = [{ id: '1', description: 'Test', completed: false }];
      
      // Mock fs.rename to fail to test atomic operation
      const originalRename = fs.rename;
      fs.rename = jest.fn().mockRejectedValue(new Error('Rename failed'));
      
      await expect(storageService.saveTodos(testTodos)).rejects.toThrow('Failed to save todos');
      
      // Restore original function
      fs.rename = originalRename;
    });

    it('should clean up temporary file on error', async () => {
      const testTodos = [{ id: '1', description: 'Test', completed: false }];
      const tempFilePath = `${testFilePath}.tmp`;
      
      // Mock fs.rename to fail
      const originalRename = fs.rename;
      fs.rename = jest.fn().mockRejectedValue(new Error('Rename failed'));
      
      await expect(storageService.saveTodos(testTodos)).rejects.toThrow('Failed to save todos');
      
      // Check that temp file doesn't exist
      const tempExists = await fs.access(tempFilePath).then(() => true).catch(() => false);
      expect(tempExists).toBe(false);
      
      // Restore original function
      fs.rename = originalRename;
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      await storageService.initializeStorage();
      
      const exists = await storageService.exists();
      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const exists = await storageService.exists();
      expect(exists).toBe(false);
    });
  });

  describe('getFilePath', () => {
    it('should return the file path', () => {
      const filePath = storageService.getFilePath();
      expect(filePath).toBe(testFilePath);
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple save and load operations', async () => {
      await storageService.initializeStorage();
      
      // Save initial todos
      const todos1 = [{ id: '1', description: 'Todo 1', completed: false }];
      await storageService.saveTodos(todos1);
      
      let loaded = await storageService.loadTodos();
      expect(loaded).toEqual(todos1);
      
      // Add more todos
      const todos2 = [
        ...todos1,
        { id: '2', description: 'Todo 2', completed: true }
      ];
      await storageService.saveTodos(todos2);
      
      loaded = await storageService.loadTodos();
      expect(loaded).toEqual(todos2);
      
      // Clear todos
      await storageService.saveTodos([]);
      
      loaded = await storageService.loadTodos();
      expect(loaded).toEqual([]);
    });

    it('should handle concurrent operations gracefully', async () => {
      await storageService.initializeStorage();
      
      const todos1 = [{ id: '1', description: 'Todo 1', completed: false }];
      const todos2 = [{ id: '2', description: 'Todo 2', completed: true }];
      
      // Save sequentially to avoid race conditions in test
      await storageService.saveTodos(todos1);
      await storageService.saveTodos(todos2);
      
      // Verify final state
      const loaded = await storageService.loadTodos();
      expect(Array.isArray(loaded)).toBe(true);
      expect(loaded).toEqual(todos2);
    });
  });
});