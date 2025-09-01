/**
 * Todo App Frontend - Main Application Module
 * Handles initialization, API communication, error handling, and user feedback
 */

class TodoApp {
    constructor() {
        this.apiBaseUrl = '/api';
        this.todos = [];
        this.isLoading = false;
        this.isOffline = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
        this.connectionCheckInterval = null;
        this.notificationTimeout = null;
        
        // DOM elements
        this.elements = {};
        
        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Todo App initializing...');
        
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start connection monitoring
            this.startConnectionMonitoring();
            
            // Load initial todos
            await this.loadTodos();
            
            console.log('Todo App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Todo App:', error);
            this.showError('Failed to initialize the application. Please refresh the page and try again.');
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            todoForm: document.getElementById('todo-form'),
            todoInput: document.getElementById('todo-input'),
            todoList: document.getElementById('todo-list'),
            todoCount: document.getElementById('todo-count'),
            loading: document.getElementById('loading'),
            emptyState: document.getElementById('empty-state'),
            formError: document.getElementById('form-error'),
            notification: document.getElementById('notification'),
            notificationMessage: document.querySelector('.notification-message'),
            notificationClose: document.querySelector('.notification-close')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Form submission for todo creation
        this.elements.todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTodoCreation();
        });

        // Notification close button
        this.elements.notificationClose.addEventListener('click', () => {
            this.hideNotification();
        });

        // Auto-hide notifications after 5 seconds
        this.notificationTimeout = null;
    }

    /**
     * API Communication Utilities
     */

    /**
     * Make API request with error handling and retry logic
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise} - API response
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const requestOptions = { ...defaultOptions, ...options };

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                // Check if we're offline before making the request
                if (!this.isOnline()) {
                    throw new Error('You are currently offline. Please check your internet connection and try again.');
                }

                const response = await fetch(url, requestOptions);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const userFriendlyError = this.getUserFriendlyError(response.status, errorData.error);
                    throw new Error(userFriendlyError);
                }

                return await response.json();
            } catch (error) {
                console.error(`API request attempt ${attempt} failed:`, error);
                
                // If this is the last attempt or it's not a network error, throw the error
                if (attempt === this.retryAttempts || !this.isNetworkError(error)) {
                    // Add context about retry attempts if multiple attempts were made
                    if (attempt > 1) {
                        const retryMessage = `Failed after ${attempt} attempts. ${error.message}`;
                        throw new Error(retryMessage);
                    }
                    throw error;
                }
                
                // Show retry notification for network errors
                if (attempt < this.retryAttempts) {
                    this.showRetryNotification(attempt, this.retryAttempts);
                }
                
                // Wait before retrying
                await this.delay(this.retryDelay * attempt);
            }
        }
    }

    /**
     * Check if error is a network-related error that should be retried
     * @param {Error} error - The error to check
     * @returns {boolean} - Whether the error is network-related
     */
    isNetworkError(error) {
        return error.name === 'TypeError' || 
               error.message.includes('fetch') ||
               error.message.includes('network') ||
               error.message.includes('Failed to fetch') ||
               error.message.includes('NetworkError') ||
               error.message.includes('timeout');
    }

    /**
     * Get user-friendly error message based on HTTP status and server error
     * @param {number} status - HTTP status code
     * @param {string} serverError - Error message from server
     * @returns {string} - User-friendly error message
     */
    getUserFriendlyError(status, serverError) {
        // Use server error message if it's user-friendly
        if (serverError && !serverError.includes('Error:') && !serverError.includes('Failed to')) {
            return serverError;
        }

        // Provide user-friendly messages based on status codes
        switch (status) {
            case 400:
                return serverError || 'The request was invalid. Please check your input and try again.';
            case 401:
                return 'You are not authorized to perform this action.';
            case 403:
                return 'Access denied. You do not have permission to perform this action.';
            case 404:
                return 'The requested item was not found. It may have been deleted.';
            case 409:
                return 'There was a conflict with your request. Please refresh and try again.';
            case 422:
                return serverError || 'The data provided was invalid. Please check your input.';
            case 429:
                return 'Too many requests. Please wait a moment and try again.';
            case 500:
                return 'A server error occurred. Please try again in a few moments.';
            case 502:
            case 503:
            case 504:
                return 'The server is temporarily unavailable. Please try again later.';
            default:
                return serverError || `An unexpected error occurred (${status}). Please try again.`;
        }
    }

    /**
     * Show retry notification to user
     * @param {number} currentAttempt - Current retry attempt
     * @param {number} maxAttempts - Maximum retry attempts
     */
    showRetryNotification(currentAttempt, maxAttempts) {
        const remainingAttempts = maxAttempts - currentAttempt;
        this.showNotification(
            `Connection failed. Retrying... (${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining)`,
            'warning'
        );
    }

    /**
     * Delay utility for retry logic
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Load todos from the API
     */
    async loadTodos() {
        try {
            this.showLoading();
            
            // Check if we're offline first
            if (!this.isOnline()) {
                throw new Error('Cannot load todos while offline. Please check your internet connection.');
            }
            
            const response = await this.apiRequest('/todos');
            
            if (response.success) {
                this.todos = response.data || [];
                this.renderTodos();
                
                // Only show success message on initial load or manual refresh
                if (this.todos.length > 0) {
                    console.log(`Loaded ${this.todos.length} todos successfully`);
                } else {
                    console.log('No todos found');
                }
            } else {
                throw new Error(response.error || 'Failed to load todos from server');
            }
        } catch (error) {
            console.error('Failed to load todos:', error);
            
            // Provide specific error messages based on error type
            let errorMessage = 'Failed to load todos';
            if (error.message.includes('offline')) {
                errorMessage = error.message;
            } else if (error.message.includes('Failed after')) {
                errorMessage = 'Unable to connect to server after multiple attempts. Please check your connection.';
            } else {
                errorMessage = `Failed to load todos: ${error.message}`;
            }
            
            this.showError(errorMessage);
            
            // Show empty state if no todos could be loaded
            this.todos = [];
            this.renderTodos();
            
            // Offer retry option for network errors
            if (this.isNetworkError(error)) {
                this.showRetryOption('load todos', () => this.loadTodos());
            }
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Handle todo creation from form submission
     */
    async handleTodoCreation() {
        const description = this.elements.todoInput.value.trim();
        
        // Clear any existing form errors
        this.hideFormError();
        
        // Client-side validation for empty descriptions (Requirement 1.3)
        if (!description) {
            this.showFormError('Please enter a todo description');
            this.elements.todoInput.focus();
            return;
        }
        
        // Additional validation for description length
        if (description.length > 500) {
            this.showFormError('Todo description must be 500 characters or less');
            this.elements.todoInput.focus();
            return;
        }
        
        try {
            // Disable form during submission
            this.setFormDisabled(true);
            
            // Create todo via API (Requirements 1.1, 1.2)
            const response = await this.apiRequest('/todos', {
                method: 'POST',
                body: JSON.stringify({ description })
            });
            
            if (response.success) {
                // Add new todo to local state
                this.todos.push(response.data);
                
                // Clear form input
                this.elements.todoInput.value = '';
                
                // Update UI (Requirement 1.2)
                this.renderTodos();
                
                // Show success message
                this.showSuccess('Todo created successfully!');
                
                // Focus back to input for easy addition of more todos
                this.elements.todoInput.focus();
            } else {
                throw new Error(response.error || 'Failed to create todo');
            }
        } catch (error) {
            console.error('Failed to create todo:', error);
            
            // Provide user-friendly error messages
            let errorMessage = 'Failed to create todo';
            if (error.message.includes('offline')) {
                errorMessage = 'Cannot create todos while offline. Please check your connection.';
            } else if (error.message.includes('Failed after')) {
                errorMessage = 'Unable to save todo after multiple attempts. Please try again.';
            } else if (error.message.includes('exceed') || error.message.includes('too long')) {
                errorMessage = 'Todo description is too long. Please keep it under 500 characters.';
            } else if (error.message.includes('empty') || error.message.includes('required')) {
                errorMessage = 'Please enter a todo description.';
            } else {
                errorMessage = `Failed to create todo: ${error.message}`;
            }
            
            // Show error in both form and notification
            this.showFormError(errorMessage);
            this.showError(errorMessage);
            
            // Offer retry for network errors
            if (this.isNetworkError(error)) {
                this.showRetryOption('create todo', () => this.handleTodoCreation());
            }
        } finally {
            // Re-enable form
            this.setFormDisabled(false);
        }
    }

    /**
     * Enable or disable the todo form
     * @param {boolean} disabled - Whether to disable the form
     */
    setFormDisabled(disabled) {
        this.elements.todoInput.disabled = disabled;
        const submitButton = this.elements.todoForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = disabled;
            submitButton.textContent = disabled ? 'Adding...' : 'Add Todo';
        }
    }

    /**
     * Render todos in the UI (Requirements 2.1, 2.2, 2.3, 2.4)
     */
    renderTodos() {
        // Update todo count
        this.updateTodoCount();
        
        // Handle empty todo list display (Requirement 2.4)
        if (this.todos.length === 0) {
            this.elements.emptyState.style.display = 'block';
            this.elements.todoList.style.display = 'none';
            return;
        }
        
        // Show todo list and hide empty state
        this.elements.emptyState.style.display = 'none';
        this.elements.todoList.style.display = 'block';
        
        // Clear existing todo items
        this.elements.todoList.innerHTML = '';
        
        // Render each todo item (Requirements 2.1, 2.2, 2.3)
        this.todos.forEach(todo => {
            const todoElement = this.createTodoElement(todo);
            this.elements.todoList.appendChild(todoElement);
        });
    }

    /**
     * Create a DOM element for a todo item
     * @param {Object} todo - Todo object
     * @returns {HTMLElement} - Todo list item element
     */
    createTodoElement(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.todoId = todo.id;
        
        // Format creation date for display
        const createdDate = new Date(todo.createdAt);
        const formattedDate = this.formatDate(createdDate);
        
        // Create todo item HTML structure
        li.innerHTML = `
            <div class="todo-item-header">
                <input 
                    type="checkbox" 
                    class="todo-checkbox" 
                    ${todo.completed ? 'checked' : ''}
                    data-todo-id="${todo.id}"
                >
                <div class="todo-content" data-todo-id="${todo.id}">
                    ${this.escapeHtml(todo.description)}
                </div>
                <div class="todo-actions">
                    <button class="btn btn-secondary btn-small edit-btn" data-todo-id="${todo.id}">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small delete-btn" data-todo-id="${todo.id}">
                        Delete
                    </button>
                </div>
            </div>
            <div class="todo-meta">
                <span class="todo-status ${todo.completed ? 'complete' : 'incomplete'}">
                    ${todo.completed ? 'Complete' : 'Incomplete'}
                </span>
                <span class="todo-date">Created: ${formattedDate}</span>
            </div>
        `;
        
        // Add event listeners for this todo item
        this.addTodoEventListeners(li, todo);
        
        return li;
    }

    /**
     * Add event listeners to a todo item element
     * @param {HTMLElement} todoElement - Todo list item element
     * @param {Object} todo - Todo object
     */
    addTodoEventListeners(todoElement, todo) {
        // Checkbox toggle
        const checkbox = todoElement.querySelector('.todo-checkbox');
        checkbox.addEventListener('change', (e) => {
            this.toggleTodoCompletion(todo.id, e.target.checked);
        });
        
        // Edit button
        const editBtn = todoElement.querySelector('.edit-btn');
        editBtn.addEventListener('click', (e) => {
            this.startEditingTodo(todo.id);
        });
        
        // Delete button
        const deleteBtn = todoElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            this.deleteTodo(todo.id);
        });
    }

    /**
     * Format date for display
     * @param {Date} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Escape HTML to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Start editing a todo item (Requirement 3.1)
     * @param {string} todoId - ID of the todo to edit
     */
    startEditingTodo(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) return;
        
        const todoElement = document.querySelector(`[data-todo-id="${todoId}"]`);
        if (!todoElement) return;
        
        const contentElement = todoElement.querySelector('.todo-content');
        const actionsElement = todoElement.querySelector('.todo-actions');
        
        // Store original content for cancel functionality
        const originalDescription = todo.description;
        
        // Create edit input
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'todo-edit-input';
        editInput.value = originalDescription;
        editInput.maxLength = 500;
        editInput.style.cssText = `
            flex: 1;
            padding: 0.5rem;
            border: 2px solid #4facfe;
            border-radius: 4px;
            font-size: 1.1rem;
            background: white;
        `;
        
        // Create edit actions
        const editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        editActions.style.cssText = 'display: flex; gap: 0.5rem; margin-left: auto;';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary btn-small';
        saveBtn.textContent = 'Save';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary btn-small';
        cancelBtn.textContent = 'Cancel';
        
        editActions.appendChild(saveBtn);
        editActions.appendChild(cancelBtn);
        
        // Replace content with edit input
        contentElement.replaceWith(editInput);
        actionsElement.replaceWith(editActions);
        
        // Focus the input and select all text
        editInput.focus();
        editInput.select();
        
        // Save functionality (Requirements 3.2, 3.4)
        const handleSave = async () => {
            const newDescription = editInput.value.trim();
            
            // Client-side validation (Requirement 3.4)
            if (!newDescription) {
                this.showError('Todo description cannot be empty');
                editInput.focus();
                return;
            }
            
            if (newDescription.length > 500) {
                this.showError('Todo description must be 500 characters or less');
                editInput.focus();
                return;
            }
            
            // If no changes, just cancel
            if (newDescription === originalDescription) {
                handleCancel();
                return;
            }
            
            try {
                // Disable buttons during save
                saveBtn.disabled = true;
                cancelBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                
                // Update todo via API
                const response = await this.apiRequest(`/todos/${todoId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ description: newDescription })
                });
                
                if (response.success) {
                    // Update local state
                    const todoIndex = this.todos.findIndex(t => t.id === todoId);
                    if (todoIndex !== -1) {
                        this.todos[todoIndex] = response.data;
                    }
                    
                    // Re-render todos to show updated content
                    this.renderTodos();
                    
                    // Show success message
                    this.showSuccess('Todo updated successfully!');
                } else {
                    throw new Error(response.error || 'Failed to update todo');
                }
            } catch (error) {
                console.error('Failed to update todo:', error);
                
                // Provide user-friendly error message
                let errorMessage = 'Failed to update todo';
                if (error.message.includes('offline')) {
                    errorMessage = 'Cannot update todos while offline. Please check your connection.';
                } else if (error.message.includes('not found')) {
                    errorMessage = 'This todo no longer exists. It may have been deleted.';
                    // Exit edit mode and refresh the list
                    handleCancel();
                    this.loadTodos();
                    return;
                } else if (error.message.includes('exceed') || error.message.includes('too long')) {
                    errorMessage = 'Description is too long. Please keep it under 500 characters.';
                } else if (error.message.includes('empty') || error.message.includes('required')) {
                    errorMessage = 'Description cannot be empty.';
                } else if (error.message.includes('Failed after')) {
                    errorMessage = 'Unable to save changes after multiple attempts. Please try again.';
                } else {
                    errorMessage = `Failed to update todo: ${error.message}`;
                }
                
                this.showError(errorMessage);
                
                // Re-enable buttons on error
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
                saveBtn.textContent = 'Save';
                editInput.focus();
                
                // Offer retry for network errors
                if (this.isNetworkError(error) && !error.message.includes('not found')) {
                    this.showRetryOption('update todo', handleSave);
                }
            }
        };
        
        // Cancel functionality (Requirement 3.3)
        const handleCancel = () => {
            // Re-render todos to restore original state
            this.renderTodos();
        };
        
        // Event listeners
        saveBtn.addEventListener('click', handleSave);
        cancelBtn.addEventListener('click', handleCancel);
        
        // Save on Enter, cancel on Escape
        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        });
    }

    /**
     * Toggle todo completion status (Requirements 4.1, 4.2, 4.3, 4.4)
     * @param {string} todoId - ID of the todo to toggle
     * @param {boolean} completed - New completion status
     */
    async toggleTodoCompletion(todoId, completed) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) return;
        
        // Store original state for rollback on error
        const originalCompleted = todo.completed;
        
        try {
            // Optimistically update UI (Requirement 4.4)
            todo.completed = completed;
            this.updateTodoElementVisualState(todoId, completed);
            
            // Update todo via API
            const response = await this.apiRequest(`/todos/${todoId}`, {
                method: 'PUT',
                body: JSON.stringify({ completed })
            });
            
            if (response.success) {
                // Update local state with server response
                const todoIndex = this.todos.findIndex(t => t.id === todoId);
                if (todoIndex !== -1) {
                    this.todos[todoIndex] = response.data;
                }
                
                // Update todo count
                this.updateTodoCount();
                
                // Show success message
                const statusText = completed ? 'completed' : 'marked as incomplete';
                this.showSuccess(`Todo ${statusText}!`);
            } else {
                throw new Error(response.error || 'Failed to update todo');
            }
        } catch (error) {
            console.error('Failed to toggle todo completion:', error);
            
            // Rollback optimistic update
            todo.completed = originalCompleted;
            this.updateTodoElementVisualState(todoId, originalCompleted);
            
            // Provide user-friendly error message
            let errorMessage = 'Failed to update todo status';
            if (error.message.includes('offline')) {
                errorMessage = 'Cannot update todos while offline. Changes will be saved when connection is restored.';
            } else if (error.message.includes('not found')) {
                errorMessage = 'This todo no longer exists. It may have been deleted.';
                // Remove from local state if it doesn't exist on server
                this.todos = this.todos.filter(t => t.id !== todoId);
                this.renderTodos();
            } else if (error.message.includes('Failed after')) {
                errorMessage = 'Unable to save changes after multiple attempts. Please try again.';
            } else {
                errorMessage = `Failed to update todo: ${error.message}`;
            }
            
            this.showError(errorMessage);
            
            // Offer retry for network errors (except for not found errors)
            if (this.isNetworkError(error) && !error.message.includes('not found')) {
                this.showRetryOption('update todo', () => this.toggleTodoCompletion(todoId, completed));
            }
        }
    }

    /**
     * Update visual state of a todo element (Requirements 4.3, 4.4)
     * @param {string} todoId - ID of the todo to update
     * @param {boolean} completed - Completion status
     */
    updateTodoElementVisualState(todoId, completed) {
        const todoElement = document.querySelector(`li[data-todo-id="${todoId}"]`);
        if (!todoElement) return;
        
        const checkbox = todoElement.querySelector('.todo-checkbox');
        const statusElement = todoElement.querySelector('.todo-status');
        
        // Update checkbox state
        if (checkbox) {
            checkbox.checked = completed;
        }
        
        // Update visual styling (Requirement 4.3)
        if (completed) {
            todoElement.classList.add('completed');
            if (statusElement) {
                statusElement.textContent = 'Complete';
                statusElement.className = 'todo-status complete';
            }
        } else {
            todoElement.classList.remove('completed');
            if (statusElement) {
                statusElement.textContent = 'Incomplete';
                statusElement.className = 'todo-status incomplete';
            }
        }
    }

    /**
     * Delete a todo item (Requirements 5.1, 5.2, 5.3)
     * @param {string} todoId - ID of the todo to delete
     */
    async deleteTodo(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) return;
        
        // Show confirmation dialog (Requirement 5.3)
        const confirmed = await this.showConfirmDialog(
            'Delete Todo',
            `Are you sure you want to delete "${todo.description}"?`,
            'Delete',
            'Cancel'
        );
        
        if (!confirmed) return;
        
        try {
            // Delete todo via API
            const response = await this.apiRequest(`/todos/${todoId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                // Remove from local state (Requirement 5.1)
                this.todos = this.todos.filter(t => t.id !== todoId);
                
                // Update UI immediately (Requirement 5.2)
                this.renderTodos();
                
                // Show success message
                this.showSuccess('Todo deleted successfully!');
            } else {
                throw new Error(response.error || 'Failed to delete todo');
            }
        } catch (error) {
            console.error('Failed to delete todo:', error);
            
            // Provide user-friendly error message
            let errorMessage = 'Failed to delete todo';
            if (error.message.includes('offline')) {
                errorMessage = 'Cannot delete todos while offline. Please check your connection.';
            } else if (error.message.includes('not found')) {
                errorMessage = 'This todo has already been deleted.';
                // Remove from local state since it doesn't exist on server
                this.todos = this.todos.filter(t => t.id !== todoId);
                this.renderTodos();
                this.showSuccess('Todo was already deleted.');
                return; // Don't show error or retry option
            } else if (error.message.includes('Failed after')) {
                errorMessage = 'Unable to delete todo after multiple attempts. Please try again.';
            } else {
                errorMessage = `Failed to delete todo: ${error.message}`;
            }
            
            this.showError(errorMessage);
            
            // Offer retry for network errors
            if (this.isNetworkError(error)) {
                this.showRetryOption('delete todo', () => this.deleteTodo(todoId));
            }
        }
    }

    /**
     * Show confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {string} confirmText - Confirm button text
     * @param {string} cancelText - Cancel button text
     * @returns {Promise<boolean>} - Whether user confirmed
     */
    showConfirmDialog(title, message, confirmText = 'OK', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            `;
            
            // Create modal dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            `;
            
            dialog.innerHTML = `
                <h3 style="margin: 0 0 1rem 0; color: #333;">${this.escapeHtml(title)}</h3>
                <p style="margin: 0 0 2rem 0; color: #666; line-height: 1.5;">${this.escapeHtml(message)}</p>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-secondary cancel-btn">${this.escapeHtml(cancelText)}</button>
                    <button class="btn btn-danger confirm-btn">${this.escapeHtml(confirmText)}</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // Event listeners
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            
            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
            
            // Close on Escape key
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeydown);
                    cleanup();
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleKeydown);
            
            // Focus confirm button
            confirmBtn.focus();
        });
    }

    /**
     * Update todo count display
     */
    updateTodoCount() {
        const count = this.todos.length;
        const completedCount = this.todos.filter(todo => todo.completed).length;
        this.elements.todoCount.textContent = `${count} todo${count !== 1 ? 's' : ''} (${completedCount} completed)`;
    }

    /**
     * Loading State Management
     */

    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;
        this.elements.loading.style.display = 'flex';
        this.elements.todoList.style.display = 'none';
        this.elements.emptyState.style.display = 'none';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.isLoading = false;
        this.elements.loading.style.display = 'none';
    }

    /**
     * User Feedback and Error Handling
     */

    /**
     * Show error message to user
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Show success message to user
     * @param {string} message - Success message to display
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Show notification to user
     * @param {string} message - Message to display
     * @param {string} type - Type of notification ('error', 'success', 'info', 'warning')
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    showNotification(message, type = 'info', duration = 5000) {
        this.elements.notificationMessage.textContent = message;
        this.elements.notification.className = `notification notification-${type}`;
        this.elements.notification.style.display = 'flex';

        // Add appropriate icon based on type
        const icon = this.getNotificationIcon(type);
        this.elements.notificationMessage.innerHTML = `${icon} ${this.escapeHtml(message)}`;

        // Clear existing timeout
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        // Auto-hide after specified duration (unless duration is 0)
        if (duration > 0) {
            this.notificationTimeout = setTimeout(() => {
                this.hideNotification();
            }, duration);
        }

        // Add animation class for better UX
        this.elements.notification.style.animation = 'slideIn 0.3s ease';
    }

    /**
     * Get appropriate icon for notification type
     * @param {string} type - Notification type
     * @returns {string} - Icon HTML
     */
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Hide notification
     */
    hideNotification() {
        this.elements.notification.style.display = 'none';
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
        }
    }

    /**
     * Show form error
     * @param {string} message - Error message to display
     */
    showFormError(message) {
        this.elements.formError.textContent = message;
        this.elements.formError.style.display = 'block';
    }

    /**
     * Hide form error
     */
    hideFormError() {
        this.elements.formError.style.display = 'none';
    }

    /**
     * Network Error Recovery and Connection Monitoring
     */

    /**
     * Check if the application is online
     * @returns {boolean} - Whether the application is online
     */
    isOnline() {
        return navigator.onLine;
    }

    /**
     * Handle offline state
     */
    handleOffline() {
        this.isOffline = true;
        this.showError('You are currently offline. Changes will be saved when your connection is restored.');
        
        // Add visual indicator for offline state
        this.addOfflineIndicator();
    }

    /**
     * Handle online state
     */
    handleOnline() {
        if (this.isOffline) {
            this.isOffline = false;
            this.removeOfflineIndicator();
            this.showSuccess('Connection restored. Syncing your data...');
            
            // Reload todos to ensure we have the latest data
            this.loadTodos();
        }
    }

    /**
     * Add visual offline indicator
     */
    addOfflineIndicator() {
        // Remove existing indicator if present
        this.removeOfflineIndicator();
        
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ffc107;
            color: #212529;
            text-align: center;
            padding: 0.5rem;
            font-weight: 500;
            z-index: 2000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        indicator.innerHTML = `
            <span>📡 You're offline - Changes will be saved when connection is restored</span>
        `;
        
        document.body.insertBefore(indicator, document.body.firstChild);
        
        // Adjust container margin to account for indicator
        const container = document.querySelector('.container');
        if (container) {
            container.style.marginTop = '60px';
        }
    }

    /**
     * Remove offline indicator
     */
    removeOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.remove();
            
            // Reset container margin
            const container = document.querySelector('.container');
            if (container) {
                container.style.marginTop = '';
            }
        }
    }

    /**
     * Test connection to server
     * @returns {Promise<boolean>} - Whether server is reachable
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/todos`, {
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Start connection monitoring
     */
    startConnectionMonitoring() {
        // Check connection every 30 seconds when offline
        this.connectionCheckInterval = setInterval(async () => {
            if (!this.isOnline() || this.isOffline) {
                const isServerReachable = await this.testConnection();
                if (isServerReachable && navigator.onLine) {
                    this.handleOnline();
                }
            }
        }, 30000);
    }

    /**
     * Stop connection monitoring
     */
    stopConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    /**
     * Show retry option to user
     * @param {string} action - Action that failed
     * @param {Function} retryCallback - Function to call when user clicks retry
     */
    showRetryOption(action, retryCallback) {
        // Create retry notification
        const retryContainer = document.createElement('div');
        retryContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #17a2b8;
            color: white;
            padding: 1rem;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 1500;
            max-width: 300px;
        `;
        
        retryContainer.innerHTML = `
            <span>Failed to ${action}. Would you like to try again?</span>
            <button class="btn btn-primary btn-small retry-btn" style="margin: 0; padding: 0.3rem 0.6rem;">Retry</button>
            <button class="retry-close" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
        `;
        
        document.body.appendChild(retryContainer);
        
        // Add event listeners
        const retryBtn = retryContainer.querySelector('.retry-btn');
        const closeBtn = retryContainer.querySelector('.retry-close');
        
        const cleanup = () => {
            if (document.body.contains(retryContainer)) {
                document.body.removeChild(retryContainer);
            }
        };
        
        retryBtn.addEventListener('click', () => {
            cleanup();
            retryCallback();
        });
        
        closeBtn.addEventListener('click', cleanup);
        
        // Auto-remove after 10 seconds
        setTimeout(cleanup, 10000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.todoApp = new TodoApp();
        
        // Set up online/offline event listeners
        window.addEventListener('offline', () => {
            window.todoApp.handleOffline();
        });
        
        window.addEventListener('online', () => {
            window.todoApp.handleOnline();
        });
        
        // Set up beforeunload event to clean up resources
        window.addEventListener('beforeunload', () => {
            if (window.todoApp) {
                window.todoApp.stopConnectionMonitoring();
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize Todo App:', error);
        
        // Show a basic error message if the app fails to initialize
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc3545;
            color: white;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            z-index: 9999;
        `;
        errorDiv.innerHTML = `
            <h3>Application Error</h3>
            <p>Failed to initialize the Todo application.</p>
            <button onclick="location.reload()" style="background: white; color: #dc3545; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Reload Page</button>
        `;
        document.body.appendChild(errorDiv);
    }
});

console.log('Todo App module loaded successfully');