const TodoService = require('../../../services/todoService');
const Todo = require('../../../models/Todo');

// Mock the StorageService
const mockStorageService = {
  initializeStorage: jest.fn(),
  loadTodos: jest.fn(),
  saveTodos: jest.fn()
};

describe('TodoService', () => {
  let todoService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create new service instance with mocked storage
    todoService = new TodoService(mockStorageService);
  });

  describe('initialize', () => {
    test('should initialize storage service', async () => {
      await todoService.initialize();
      expect(mockStorageService.initializeStorage).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllTodos', () => {
    test('should return empty array when no todos exist', async () => {
      mockStorageService.loadTodos.mockResolvedValue([]);
      
      const todos = await todoService.getAllTodos();
      
      expect(todos).toEqual([]);
      expect(mockStorageService.loadTodos).toHaveBeenCalledTimes(1);
    });

    test('should return array of Todo instances', async () => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'First todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-2',
          description: 'Second todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      
      const todos = await todoService.getAllTodos();
      
      expect(todos).toHaveLength(2);
      expect(todos[0]).toBeInstanceOf(Todo);
      expect(todos[1]).toBeInstanceOf(Todo);
      expect(todos[0].id).toBe('todo-1');
      expect(todos[1].id).toBe('todo-2');
    });

    test('should throw error when storage fails', async () => {
      mockStorageService.loadTodos.mockRejectedValue(new Error('Storage error'));
      
      await expect(todoService.getAllTodos()).rejects.toThrow('Failed to retrieve todos: Storage error');
    });
  });

  describe('getTodoById', () => {
    beforeEach(() => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'First todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
    });

    test('should return todo when found', async () => {
      const todo = await todoService.getTodoById('todo-1');
      
      expect(todo).toBeInstanceOf(Todo);
      expect(todo.id).toBe('todo-1');
    });

    test('should return null when todo not found', async () => {
      const todo = await todoService.getTodoById('nonexistent');
      
      expect(todo).toBeNull();
    });

    test('should throw error for invalid ID', async () => {
      await expect(todoService.getTodoById('')).rejects.toThrow('Valid todo ID is required');
      await expect(todoService.getTodoById(null)).rejects.toThrow('Valid todo ID is required');
      await expect(todoService.getTodoById(123)).rejects.toThrow('Valid todo ID is required');
    });
  });

  describe('createTodo', () => {
    beforeEach(() => {
      mockStorageService.loadTodos.mockResolvedValue([]);
      mockStorageService.saveTodos.mockResolvedValue();
    });

    test('should create and save new todo', async () => {
      const description = 'New todo item';
      
      const todo = await todoService.createTodo(description);
      
      expect(todo).toBeInstanceOf(Todo);
      expect(todo.description).toBe(description);
      expect(todo.completed).toBe(false);
      expect(mockStorageService.saveTodos).toHaveBeenCalledWith([todo.toJSON()]);
    });

    test('should add todo to existing todos', async () => {
      const existingTodoData = {
        id: 'existing-todo',
        description: 'Existing todo',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockStorageService.loadTodos.mockResolvedValue([existingTodoData]);
      
      const newTodo = await todoService.createTodo('New todo');
      
      // Verify that saveTodos was called with 2 todos
      const savedTodos = mockStorageService.saveTodos.mock.calls[0][0];
      expect(savedTodos).toHaveLength(2);
      expect(savedTodos[0].id).toBe('existing-todo');
      expect(savedTodos[1].id).toBe(newTodo.id);
      expect(savedTodos[1].description).toBe('New todo');
    });

    test('should throw error for invalid description', async () => {
      await expect(todoService.createTodo('')).rejects.toThrow('Failed to create todo: Description cannot be empty');
      await expect(todoService.createTodo('a'.repeat(501))).rejects.toThrow('Failed to create todo: Description cannot exceed 500 characters');
    });

    test('should throw error when storage fails', async () => {
      mockStorageService.saveTodos.mockRejectedValue(new Error('Storage error'));
      
      await expect(todoService.createTodo('Test todo')).rejects.toThrow('Failed to create todo: Storage error');
    });
  });

  describe('updateTodo', () => {
    beforeEach(() => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'Original description',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      mockStorageService.saveTodos.mockResolvedValue();
    });

    test('should update todo description', async () => {
      const updates = { description: 'Updated description' };
      
      const updatedTodo = await todoService.updateTodo('todo-1', updates);
      
      expect(updatedTodo.description).toBe('Updated description');
      expect(mockStorageService.saveTodos).toHaveBeenCalledTimes(1);
    });

    test('should update todo completion status', async () => {
      const updates = { completed: true };
      
      const updatedTodo = await todoService.updateTodo('todo-1', updates);
      
      expect(updatedTodo.completed).toBe(true);
      expect(mockStorageService.saveTodos).toHaveBeenCalledTimes(1);
    });

    test('should update both description and completion status', async () => {
      const updates = { description: 'New description', completed: true };
      
      const updatedTodo = await todoService.updateTodo('todo-1', updates);
      
      expect(updatedTodo.description).toBe('New description');
      expect(updatedTodo.completed).toBe(true);
    });

    test('should throw error for invalid ID', async () => {
      await expect(todoService.updateTodo('', {})).rejects.toThrow('Valid todo ID is required');
      await expect(todoService.updateTodo(null, {})).rejects.toThrow('Valid todo ID is required');
    });

    test('should throw error for missing updates', async () => {
      await expect(todoService.updateTodo('todo-1', null)).rejects.toThrow('Updates object is required');
      await expect(todoService.updateTodo('todo-1', 'string')).rejects.toThrow('Updates object is required');
    });

    test('should throw error when todo not found', async () => {
      await expect(todoService.updateTodo('nonexistent', {})).rejects.toThrow('Todo not found');
    });

    test('should throw error for invalid description update', async () => {
      const updates = { description: '' };
      await expect(todoService.updateTodo('todo-1', updates)).rejects.toThrow('Description cannot be empty');
    });
  });

  describe('toggleComplete', () => {
    beforeEach(() => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'Test todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      mockStorageService.saveTodos.mockResolvedValue();
    });

    test('should toggle completion status from false to true', async () => {
      const updatedTodo = await todoService.toggleComplete('todo-1');
      
      expect(updatedTodo.completed).toBe(true);
      expect(mockStorageService.saveTodos).toHaveBeenCalledTimes(1);
    });

    test('should toggle completion status from true to false', async () => {
      // Set up todo as completed
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'Test todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      
      const updatedTodo = await todoService.toggleComplete('todo-1');
      
      expect(updatedTodo.completed).toBe(false);
    });

    test('should throw error for invalid ID', async () => {
      await expect(todoService.toggleComplete('')).rejects.toThrow('Valid todo ID is required');
      await expect(todoService.toggleComplete(null)).rejects.toThrow('Valid todo ID is required');
    });

    test('should throw error when todo not found', async () => {
      await expect(todoService.toggleComplete('nonexistent')).rejects.toThrow('Todo not found');
    });
  });

  describe('deleteTodo', () => {
    beforeEach(() => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'First todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-2',
          description: 'Second todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      mockStorageService.saveTodos.mockResolvedValue();
    });

    test('should delete existing todo', async () => {
      const result = await todoService.deleteTodo('todo-1');
      
      expect(result).toBe(true);
      expect(mockStorageService.saveTodos).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'todo-2' })
      ]);
    });

    test('should throw error for invalid ID', async () => {
      await expect(todoService.deleteTodo('')).rejects.toThrow('Valid todo ID is required');
      await expect(todoService.deleteTodo(null)).rejects.toThrow('Valid todo ID is required');
    });

    test('should throw error when todo not found', async () => {
      await expect(todoService.deleteTodo('nonexistent')).rejects.toThrow('Todo not found');
    });
  });

  describe('getTodosCount', () => {
    test('should return correct counts', async () => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'First todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-2',
          description: 'Second todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-3',
          description: 'Third todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      
      const counts = await todoService.getTodosCount();
      
      expect(counts).toEqual({
        total: 3,
        completed: 1,
        incomplete: 2
      });
    });

    test('should return zero counts for empty list', async () => {
      mockStorageService.loadTodos.mockResolvedValue([]);
      
      const counts = await todoService.getTodosCount();
      
      expect(counts).toEqual({
        total: 0,
        completed: 0,
        incomplete: 0
      });
    });
  });

  describe('clearAllTodos', () => {
    test('should clear all todos', async () => {
      mockStorageService.saveTodos.mockResolvedValue();
      
      const result = await todoService.clearAllTodos();
      
      expect(result).toBe(true);
      expect(mockStorageService.saveTodos).toHaveBeenCalledWith([]);
    });
  });

  describe('clearCompletedTodos', () => {
    test('should clear only completed todos', async () => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'Incomplete todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-2',
          description: 'Completed todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-3',
          description: 'Another completed todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      mockStorageService.saveTodos.mockResolvedValue();
      
      const clearedCount = await todoService.clearCompletedTodos();
      
      expect(clearedCount).toBe(2);
      expect(mockStorageService.saveTodos).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'todo-1', completed: false })
      ]);
    });

    test('should return 0 when no completed todos exist', async () => {
      const mockTodosData = [
        {
          id: 'todo-1',
          description: 'Incomplete todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      mockStorageService.loadTodos.mockResolvedValue(mockTodosData);
      
      const clearedCount = await todoService.clearCompletedTodos();
      
      expect(clearedCount).toBe(0);
    });
  });
});