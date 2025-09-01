const { v4: uuidv4 } = require('uuid');

/**
 * Todo model class with validation and business logic
 * Test comment to trigger hook
 */
class Todo {
  constructor(description, id = null) {
    this.id = id || uuidv4();
    this.description = this.validateDescription(description);
    this.completed = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Validate todo description
   * @param {string} description - The todo description
   * @returns {string} Validated description
   * @throws {Error} If description is invalid
   */
  validateDescription(description) {
    if (typeof description !== 'string') {
      throw new Error('Description must be a string');
    }

    const trimmed = description.trim();
    
    if (trimmed.length === 0) {
      throw new Error('Description cannot be empty');
    }

    if (trimmed.length > 500) {
      throw new Error('Description cannot exceed 500 characters');
    }

    return trimmed;
  }

  /**
   * Update the todo description
   * @param {string} newDescription - New description
   */
  updateDescription(newDescription) {
    this.description = this.validateDescription(newDescription);
    this.updatedAt = new Date();
  }

  /**
   * Toggle completion status
   */
  toggleComplete() {
    this.completed = !this.completed;
    this.updatedAt = new Date();
  }

  /**
   * Set completion status
   * @param {boolean} completed - Completion status
   */
  setCompleted(completed) {
    if (typeof completed !== 'boolean') {
      throw new Error('Completed status must be a boolean');
    }
    this.completed = completed;
    this.updatedAt = new Date();
  }

  /**
   * Convert todo to plain object for JSON serialization
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      description: this.description,
      completed: this.completed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create Todo instance from plain object
   * @param {Object} data - Plain object with todo data
   * @returns {Todo} Todo instance
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid todo data');
    }

    const todo = new Todo(data.description, data.id);
    
    if (typeof data.completed === 'boolean') {
      todo.completed = data.completed;
    }
    
    if (data.createdAt) {
      todo.createdAt = new Date(data.createdAt);
    }
    
    if (data.updatedAt) {
      todo.updatedAt = new Date(data.updatedAt);
    }

    return todo;
  }

  /**
   * Validate todo data object
   * @param {Object} data - Todo data to validate
   * @returns {boolean} True if valid
   * @throws {Error} If data is invalid
   */
  static validate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Todo data must be an object');
    }

    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Todo must have a valid ID');
    }

    if (!data.description || typeof data.description !== 'string') {
      throw new Error('Todo must have a valid description');
    }

    if (data.description.trim().length === 0) {
      throw new Error('Todo description cannot be empty');
    }

    if (data.description.length > 500) {
      throw new Error('Todo description cannot exceed 500 characters');
    }

    if (data.completed !== undefined && typeof data.completed !== 'boolean') {
      throw new Error('Todo completed status must be a boolean');
    }

    return true;
  }
}

module.exports = Todo;