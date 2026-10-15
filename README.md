# Hotel-Rooms-api
REST API for managing hotel rooms using Node.js and Express

## Requirements

- Node.js
- npm

## Setup and Execution

1. Clone or download this repository.
2. Open the project folder in VS Code.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   node index.js
   ```

5. The server runs at `http://localhost:8080` by default.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/rooms` | Create a room |
| GET | `/api/rooms` | Get all rooms |
| GET | `/api/rooms/:id` | Get a room by ID |
| PUT | `/api/rooms/:id` | Replace a room |
| PATCH | `/api/rooms/:id` | Update selected room fields |
| DELETE | `/api/rooms/:id` | Delete a room |

## Example Request

Send a POST request to `/api/rooms` with this JSON body:

```json
{
  "name": "Lake View Deluxe",
  "location": "Ooty",
  "type": "Deluxe",
  "pricePerNight": 4500,
  "capacity": 3,
  "available": true,
  "roomNumber": "R-204"
}
```

## Notes

- Room data is stored in memory and resets when the server restarts.
- The default port is 8080. You can override it using the `PORT` environment variable.
