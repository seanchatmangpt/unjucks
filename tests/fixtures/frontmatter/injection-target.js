// User Service Module
class UserService {
  constructor() {
    this.users = [];
  }

  // INSERT_POINT

  getAllUsers() {
    return this.users;
  }
}

module.exports = UserService;