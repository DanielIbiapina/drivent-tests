import app, { init } from '@/app';
import faker from '@faker-js/faker';
import httpStatus from 'http-status';
import supertest from 'supertest';
import { createEnrollmentWithAddress, createTicket, createTicketType, createUser } from '../factories';
import { cleanDb, generateValidToken } from '../helpers';
import * as jwt from 'jsonwebtoken';
import { Hotel, TicketStatus } from '@prisma/client';
import { prisma } from '@/config';
import { getHotels } from '@/controllers';
import { createHotel, createRooms } from '../factories/hotels-factory';

beforeAll(async () => {
  await init();
});

beforeEach(async () => {
  await cleanDb();
});

const server = supertest(app);

describe('GET /hotels', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.get('/hotels');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when user doesnt have an enrollment yet', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when user doesnt have a ticket yet', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      await createEnrollmentWithAddress(user);

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 404 when user doesnt have a hotel yet', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      await prisma.hotel.deleteMany({});

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 402 when ticket isnt paid', async () => {
      const user = await createUser();
      const enrollment = await createEnrollmentWithAddress(user);
      const token = await generateValidToken(user);
      const ticketType = await createTicketType();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
    });

    it('should respond with status 402 when ticket is remote', async () => {
      const user = await createUser();
      const enrollment = await createEnrollmentWithAddress(user);
      const token = await generateValidToken(user);
      const ticketType = await createTicketType();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

      if (ticketType.isRemote === true) {
        const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);
        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      }
    });

    it('should respond with status 402 when ticket doesnt include hotel', async () => {
      const user = await createUser();
      const enrollment = await createEnrollmentWithAddress(user);
      const token = await generateValidToken(user);
      const ticketType = await createTicketType();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

      if (ticketType.includesHotel === false) {
        const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);
        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      }
    });

    it('should respond with status 200 and with hotels data', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketType();
      await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      const hotel = await createHotel();

      const response = await server.get('/hotels').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining<Omit<Hotel, 'createdAt' | 'updatedAt'>>({
            name: hotel.name,
            id: hotel.id,
            image: hotel.image,
          }),
        ]),
      );
    });
  });
});

describe('GET /hotels/:hotelId', () => {
  it('if hotelId is valid', async () => {
    const user = await createUser();
    const enrollment = await createEnrollmentWithAddress(user);
    const token = await generateValidToken(user);
    const ticketType = await createTicketType();
    const hotel = await createHotel();
    await createRooms(hotel.id);
    const hotelWithRooms = await prisma.hotel.findFirst({
      where: { id: hotel.id },
      include: {
        Rooms: true,
      },
    });
    await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
    const response = await server.get(`/hotels/${hotel.id}`).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.OK);
    expect(response.body[0]).toEqual({
      id: hotelWithRooms.id,
      name: hotelWithRooms.name,
      image: hotelWithRooms.image,
      createdAt: hotelWithRooms.createdAt.toISOString(),
      updatedAt: hotelWithRooms.updatedAt.toISOString(),
      Rooms: [
        {
          id: hotelWithRooms.Rooms[0].id,
          name: hotelWithRooms.Rooms[0].name,
          capacity: hotelWithRooms.Rooms[0].capacity,
          hotelId: hotelWithRooms.Rooms[0].hotelId,
          createdAt: hotelWithRooms.Rooms[0].createdAt.toISOString(),
          updatedAt: hotelWithRooms.Rooms[0].updatedAt.toISOString(),
        },
      ],
    });
  });

  it('should respond with status 404 when user doesnt find hotel rooms', async () => {
    const user = await createUser();
    const enrollment = await createEnrollmentWithAddress(user);
    const token = await generateValidToken(user);
    const ticketType = await createTicketType();
    const hotel = await createHotel();
    await createRooms(hotel.id);
    const hotelWithRooms = await prisma.hotel.findFirst({
      where: { id: hotel.id },
      include: {
        Rooms: true,
      },
    });
    await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

    const response = await server.get(`/hotels/0`).set('Authorization', `Bearer ${token}`);

    expect(response.status).toEqual(httpStatus.NOT_FOUND);
  });
});
