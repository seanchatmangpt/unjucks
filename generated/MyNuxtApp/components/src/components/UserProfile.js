/**
 * UserProfile component
 */
export class UserProfile {
  constructor() {
    this.name = 'UserProfile';
  }

  render() {
    return `<div class="userprofile">${this.name}</div>`;
  }
}

export default UserProfile;