import { notFoundError, paymentRequiredError } from '@/errors';
import enrollmentRepository from '@/repositories/enrollment-repository';
import hotelRepository from '@/repositories/hotel-repository';
import ticketRepository from '@/repositories/ticket-repository';
import { TicketStatus } from '@prisma/client';
import { PAYMENT_REQUIRED } from 'http-status';

async function getHotels(userId: number) {
  const enrollment = await enrollmentRepository.findWithAddressByUserId(userId);
  if (!enrollment) {
    throw notFoundError();
  }
  const ticket = await ticketRepository.findTicketByEnrollmentId(enrollment.id);
  if (!ticket) {
    throw notFoundError();
  }
  if (ticket.status !== TicketStatus.PAID || ticket.TicketType.isRemote || !ticket.TicketType.includesHotel) {
    throw paymentRequiredError();
  }

  const hotels = await hotelRepository.findHotels();
  if (!hotels) {
    throw notFoundError();
  }
  return hotels;
}
async function getHotelRooms(hotelId: string) {
  const hotelRooms = await hotelRepository.findHotelRooms(Number(hotelId));
  if (hotelRooms.length === 0) {
    throw notFoundError();
  }
  return hotelRooms;
}

const hotelService = {
  getHotels,
  getHotelRooms,
};

export default hotelService;
