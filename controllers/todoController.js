const TodoService = require('../services/todoService');

/**
 * Todo Controller handling HTTP requests for todo operations
 */
class TodoController {
  constructor() {
    this.todoService = new TodoService();
    this.initialized = false;
  }

  /**
   * Initialize the controller and service
   */
  async initialize() {
    if (!this.initialized) {
      await this.todoService.initialize();
      this.initialized = true;
    }
  }

  /**
   * GET /api/todos - Retrieve all todos
   * Requirements: 6.1, 2.1, 2.4
   */
  async getAllTodos(req, res) {
    try {
      await this.initialize();
      
      const todos = await this.todoService.getAllTodos();
      
      res.json({
        success: true,
        data: todos.map(todo => todo.toJSON()),
        message: todos.length === 0 ? 'No todos found' : undefined
      });
    } catch (error) {
      console.error('Error retrieving todos:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve todos',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/todos - Create a new todo
   * Requirements: 6.2, 1.1, 1.3, 6.5
   */
  async createTodo(req, res) {
    try {
      await this.initialize();
      
      const { description } = req.body;

      // Input validation
      if (description === undefined || description === null) {
        return res.status(400).json({
          success: false,
          error: 'Description is required and must be a string'
        });
      }

      if (typeof description !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Description is required and must be a string'
        });
      }

      const trimmedDescription = description.trim();
      if (trimmedDescription.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot be empty'
        });
      }

      if (trimmedDescription.length > 500) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot exceed 500 characters'
        });
      }

      const todo = await this.todoService.createTodo(trimmedDescription);
      
      res.status(201).json({
        success: true,
        data: todo.toJSON(),
        message: 'Todo created successfully'
      });
    } catch (error) {
      console.error('Error creating todo:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create todo',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  }

  /**
   * PUT /api/todos/:id - Update an existing todo
   * Requirements: 6.3, 3.2, 3.4, 4.1, 4.2
   */
  async updateTodo(req, res) {
    try {
      await this.initialize();
      
      const { id } = req.params;
      const updates = req.body;

      // Validate ID
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Valid todo ID is required'
        });
      }

      // Validate updates object
      if (updates === undefined || updates === null || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Updates object is required'
        });
      }

      // Validate description if provided
      if (updates.description !== undefined) {
        if (typeof updates.description !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Description must be a string'
          });
        }

        const trimmedDescription = updates.description.trim();
        if (trimmedDescription.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Description cannot be empty'
          });
        }

        if (trimmedDescription.length > 500) {
          return res.status(400).json({
            success: false,
            error: 'Description cannot exceed 500 characters'
          });
        }

        updates.description = trimmedDescription;
      }

      // Validate completed status if provided
      if (updates.completed !== undefined && typeof updates.completed !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Completed status must be a boolean'
        });
      }

      const updatedTodo = await this.todoService.updateTodo(id, updates);
      
      res.json({
        success: true,
        data: updatedTodo.toJSON(),
        message: 'Todo updated successfully'
      });
    } catch (error) {
      console.error('Error updating todo:', error);
      
      if (error.message === 'Todo not found') {
        return res.status(404).json({
          success: false,
          error: 'Todo not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update todo',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  }

  /**
   * DELETE /api/todos/:id - Delete a todo
   * Requirements: 6.4, 5.4
   */
  async deleteTodo(req, res) {
    try {
      await this.initialize();
      
      const { id } = req.params;

      // Validate ID
      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Valid todo ID is required'
        });
      }

      await this.todoService.deleteTodo(id);
      
      res.json({
        success: true,
        message: 'Todo deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting todo:', error);
      
      if (error.message === 'Todo not found') {
        return res.status(404).json({
          success: false,
          error: 'Todo not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete todo',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }
  }
}

module.exports = TodoController;