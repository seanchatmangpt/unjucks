// Sample file for testing inject command
class UserService {
  constructor() {
    this.users = [];
  }

  getUser(id) {
    return this.users.find(user => user.id === id);
  }
}

module.exports = UserService;