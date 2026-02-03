const bcrypt = require('bcrypt');
const saltRounds = 10; // A standard value for the "cost factor"
const plainTextPassword = 'Viewplus';

bcrypt.hash(plainTextPassword, saltRounds, function(err, hash) {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    console.log('Your new hashed password is:');
    console.log(hash);
});