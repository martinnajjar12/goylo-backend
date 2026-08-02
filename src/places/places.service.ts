import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class GooglePlacesService {
  private readonly baseUrl = 'https://places.googleapis.com/v1';
  private get apiKey() {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new BadRequestException('Google Places is not configured');
    return key;
  }
  async autocomplete(input: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({ input }),
    });
    return this.readResponse(response);
  }
  async details(placeId: string): Promise<unknown> {
    const fields =
      'id,displayName,formattedAddress,location,addressComponents,googleMapsUri';
    const response = await fetch(
      `${this.baseUrl}/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(fields)}`,
      {
        headers: { 'X-Goog-Api-Key': this.apiKey },
      },
    );
    return this.readResponse(response);
  }
  private async readResponse(response: Response): Promise<unknown> {
    const body: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'object' &&
        body.error !== null &&
        'message' in body.error &&
        typeof body.error.message === 'string'
          ? body.error.message
          : 'Google Places request failed';
      throw new BadRequestException(message);
    }
    return body;
  }
}
