const Todo = require('../models/Todo');
const StorageService = require('./storageService');

/**
 * Todo service class handling business logic and CRUD operations
 */
class TodoService {
  constructor(storageService = null) {
    this.storageService = storageService || new StorageService();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    await this.storageService.initializeStorage();
  }

  /**
   * Get all todos
   * @returns {Promise<Array<Todo>>} Array of Todo instances
   */
  async getAllTodos() {
    try {
      const todosData = await this.storageService.loadTodos();
      return todosData.map(data => Todo.fromJSON(data));
    } catch (error) {
      throw new Error(`Failed to retrieve todos: ${error.message}`);
    }
  }

  /**
   * Get todo by ID
   * @param {string} id - Todo ID
   * @returns {Promise<Todo|null>} Todo instance or null if not found
   */
  async getTodoById(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid todo ID is required');
    }

    const todos = await this.getAllTodos();
    return todos.find(todo => todo.id === id) || null;
  }

  /**
   * Create a new todo
   * @param {string} description - Todo description
   * @returns {Promise<Todo>} Created Todo instance
   */
  async createTodo(description) {
    try {
      const todo = new Todo(description);
      
      const todos = await this.getAllTodos();
      todos.push(todo);
      
      await this.storageService.saveTodos(todos.map(t => t.toJSON()));
      
      return todo;
    } catch (error) {
      throw new Error(`Failed to create todo: ${error.message}`);
    }
  }

  /**
   * Update an existing todo
   * @param {string} id - Todo ID
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.description] - New description
   * @param {boolean} [updates.completed] - New completion status
   * @returns {Promise<Todo>} Updated Todo instance
   */
  async updateTodo(id, updates) {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid todo ID is required');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates object is required');
    }

    const todos = await this.getAllTodos();
    const todoIndex = todos.findIndex(todo => todo.id === id);
    
    if (todoIndex === -1) {
      throw new Error('Todo not found');
    }

    const todo = todos[todoIndex];

    // Apply updates
    if (updates.description !== undefined) {
      todo.updateDescription(updates.description);
    }

    if (updates.completed !== undefined) {
      todo.setCompleted(updates.completed);
    }

    // Save updated todos
    await this.storageService.saveTodos(todos.map(t => t.toJSON()));
    
    return todo;
  }

  /**
   * Toggle todo completion status
   * @param {string} id - Todo ID
   * @returns {Promise<Todo>} Updated Todo instance
   */
  async toggleComplete(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid todo ID is required');
    }

    const todos = await this.getAllTodos();
    const todoIndex = todos.findIndex(todo => todo.id === id);
    
    if (todoIndex === -1) {
      throw new Error('Todo not found');
    }

    const todo = todos[todoIndex];
    todo.toggleComplete();

    // Save updated todos
    await this.storageService.saveTodos(todos.map(t => t.toJSON()));
    
    return todo;
  }

  /**
   * Delete a todo
   * @param {string} id - Todo ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteTodo(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid todo ID is required');
    }

    const todos = await this.getAllTodos();
    const todoIndex = todos.findIndex(todo => todo.id === id);
    
    if (todoIndex === -1) {
      throw new Error('Todo not found');
    }

    // Remove todo from array
    todos.splice(todoIndex, 1);

    // Save updated todos
    await this.storageService.saveTodos(todos.map(t => t.toJSON()));
    
    return true;
  }

  /**
   * Get todos count
   * @returns {Promise<Object>} Object with total, completed, and incomplete counts
   */
  async getTodosCount() {
    const todos = await this.getAllTodos();
    
    return {
      total: todos.length,
      completed: todos.filter(todo => todo.completed).length,
      incomplete: todos.filter(todo => !todo.completed).length
    };
  }

  /**
   * Clear all todos
   * @returns {Promise<boolean>} True if cleared successfully
   */
  async clearAllTodos() {
    await this.storageService.saveTodos([]);
    return true;
  }

  /**
   * Clear completed todos
   * @returns {Promise<number>} Number of todos cleared
   */
  async clearCompletedTodos() {
    const todos = await this.getAllTodos();
    const incompleteTodos = todos.filter(todo => !todo.completed);
    const clearedCount = todos.length - incompleteTodos.length;
    
    await this.storageService.saveTodos(incompleteTodos.map(t => t.toJSON()));
    
    return clearedCount;
  }
}

module.exports = TodoService;