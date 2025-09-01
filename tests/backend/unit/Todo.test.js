const Todo = require('../../../models/Todo');

describe('Todo Model', () => {
  describe('Constructor', () => {
    test('should create a new todo with valid description', () => {
      const description = 'Test todo item';
      const todo = new Todo(description);

      expect(todo.id).toBeDefined();
      expect(typeof todo.id).toBe('string');
      expect(todo.description).toBe(description);
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
    });

    test('should create todo with custom ID', () => {
      const customId = 'custom-id-123';
      const todo = new Todo('Test description', customId);

      expect(todo.id).toBe(customId);
    });

    test('should trim whitespace from description', () => {
      const todo = new Todo('  Test description  ');
      expect(todo.description).toBe('Test description');
    });

    test('should throw error for empty description', () => {
      expect(() => new Todo('')).toThrow('Description cannot be empty');
      expect(() => new Todo('   ')).toThrow('Description cannot be empty');
    });

    test('should throw error for non-string description', () => {
      expect(() => new Todo(123)).toThrow('Description must be a string');
      expect(() => new Todo(null)).toThrow('Description must be a string');
      expect(() => new Todo(undefined)).toThrow('Description must be a string');
    });

    test('should throw error for description exceeding 500 characters', () => {
      const longDescription = 'a'.repeat(501);
      expect(() => new Todo(longDescription)).toThrow('Description cannot exceed 500 characters');
    });

    test('should accept description with exactly 500 characters', () => {
      const maxDescription = 'a'.repeat(500);
      const todo = new Todo(maxDescription);
      expect(todo.description).toBe(maxDescription);
    });
  });

  describe('updateDescription', () => {
    test('should update description and updatedAt timestamp', async () => {
      const todo = new Todo('Original description');
      const originalUpdatedAt = todo.updatedAt.getTime();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      todo.updateDescription('Updated description');
      
      expect(todo.description).toBe('Updated description');
      expect(todo.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
    });

    test('should validate new description', () => {
      const todo = new Todo('Original description');
      
      expect(() => todo.updateDescription('')).toThrow('Description cannot be empty');
      expect(() => todo.updateDescription('a'.repeat(501))).toThrow('Description cannot exceed 500 characters');
    });
  });

  describe('toggleComplete', () => {
    test('should toggle completion status from false to true', async () => {
      const todo = new Todo('Test todo');
      const originalUpdatedAt = todo.updatedAt.getTime();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      todo.toggleComplete();
      
      expect(todo.completed).toBe(true);
      expect(todo.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
    });

    test('should toggle completion status from true to false', () => {
      const todo = new Todo('Test todo');
      todo.completed = true;
      
      todo.toggleComplete();
      
      expect(todo.completed).toBe(false);
    });
  });

  describe('setCompleted', () => {
    test('should set completion status to true', async () => {
      const todo = new Todo('Test todo');
      const originalUpdatedAt = todo.updatedAt.getTime();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 2));
      
      todo.setCompleted(true);
      
      expect(todo.completed).toBe(true);
      expect(todo.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt);
    });

    test('should set completion status to false', () => {
      const todo = new Todo('Test todo');
      todo.completed = true;
      
      todo.setCompleted(false);
      
      expect(todo.completed).toBe(false);
    });

    test('should throw error for non-boolean value', () => {
      const todo = new Todo('Test todo');
      
      expect(() => todo.setCompleted('true')).toThrow('Completed status must be a boolean');
      expect(() => todo.setCompleted(1)).toThrow('Completed status must be a boolean');
    });
  });

  describe('toJSON', () => {
    test('should return plain object representation', () => {
      const todo = new Todo('Test todo');
      const json = todo.toJSON();

      expect(json).toEqual({
        id: todo.id,
        description: todo.description,
        completed: todo.completed,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt
      });
    });
  });

  describe('fromJSON', () => {
    test('should create Todo instance from valid JSON data', () => {
      const data = {
        id: 'test-id',
        description: 'Test description',
        completed: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T01:00:00.000Z'
      };

      const todo = Todo.fromJSON(data);

      expect(todo.id).toBe(data.id);
      expect(todo.description).toBe(data.description);
      expect(todo.completed).toBe(data.completed);
      expect(todo.createdAt).toEqual(new Date(data.createdAt));
      expect(todo.updatedAt).toEqual(new Date(data.updatedAt));
    });

    test('should create Todo with default values for missing optional fields', () => {
      const data = {
        id: 'test-id',
        description: 'Test description'
      };

      const todo = Todo.fromJSON(data);

      expect(todo.id).toBe(data.id);
      expect(todo.description).toBe(data.description);
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
    });

    test('should throw error for invalid data', () => {
      expect(() => Todo.fromJSON(null)).toThrow('Invalid todo data');
      expect(() => Todo.fromJSON('string')).toThrow('Invalid todo data');
      expect(() => Todo.fromJSON(123)).toThrow('Invalid todo data');
    });

    test('should validate description when creating from JSON', () => {
      const data = { id: 'test-id', description: '' };
      expect(() => Todo.fromJSON(data)).toThrow('Description cannot be empty');
    });
  });

  describe('validate', () => {
    test('should validate correct todo data', () => {
      const data = {
        id: 'test-id',
        description: 'Test description',
        completed: false
      };

      expect(Todo.validate(data)).toBe(true);
    });

    test('should throw error for missing ID', () => {
      const data = { description: 'Test description' };
      expect(() => Todo.validate(data)).toThrow('Todo must have a valid ID');
    });

    test('should throw error for invalid ID type', () => {
      const data = { id: 123, description: 'Test description' };
      expect(() => Todo.validate(data)).toThrow('Todo must have a valid ID');
    });

    test('should throw error for missing description', () => {
      const data = { id: 'test-id' };
      expect(() => Todo.validate(data)).toThrow('Todo must have a valid description');
    });

    test('should throw error for empty description', () => {
      const data = { id: 'test-id', description: '   ' };
      expect(() => Todo.validate(data)).toThrow('Todo description cannot be empty');
    });

    test('should throw error for description exceeding 500 characters', () => {
      const data = { id: 'test-id', description: 'a'.repeat(501) };
      expect(() => Todo.validate(data)).toThrow('Todo description cannot exceed 500 characters');
    });

    test('should throw error for invalid completed type', () => {
      const data = { id: 'test-id', description: 'Test', completed: 'true' };
      expect(() => Todo.validate(data)).toThrow('Todo completed status must be a boolean');
    });

    test('should throw error for null or non-object data', () => {
      expect(() => Todo.validate(null)).toThrow('Todo data must be an object');
      expect(() => Todo.validate('string')).toThrow('Todo data must be an object');
    });
  });
});