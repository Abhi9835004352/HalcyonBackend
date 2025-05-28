# Halcyon Backend

A Node.js backend server using Express and MongoDB with Mongoose.

## Project Structure

```
├── config/         # Configuration files
│   └── db.js       # Database connection
├── controllers/    # Route controllers
│   └── userController.js
├── middleware/     # Custom middleware
│   └── errorMiddleware.js
├── models/         # Mongoose models
│   └── userModel.js
├── routes/         # API routes
│   └── userRoutes.js
├── .env            # Environment variables
├── package.json    # Project dependencies
├── README.md       # Project documentation
└── server.js       # Entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add the following variables:
     ```
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/halcyon
     NODE_ENV=development
     ```

### Running the Server

Development mode:
```
npm run dev
```

Production mode:
```
npm start
```

## API Endpoints

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get a single user
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user

## License

ISC
# HalcyonBackend
