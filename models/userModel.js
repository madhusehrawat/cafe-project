const users = [];

function findByEmail(email) {
    return users.find(user => user.email === email);
}

function createUser(userData) {
    users.push(userData);
}

module.exports = {
    findByEmail,
    createUser
};