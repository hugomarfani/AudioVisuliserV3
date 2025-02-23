// Import the image
import letitgoImg from './letitgo.jpg';

export type Song = {
  id: string;
  title: string;
  artist: string;
  image: string;
  status: 'Blue' | 'Green' | 'Yellow' | 'Red';
};

export const songs: Song[] = [
  {
    id: 'spotify:track:0qcr5FMsEO85NAQjrlDRKo',
    title: 'Let It Go',
    artist: 'Idina Menzel',
    image: letitgoImg,  // Use the imported image
    status: 'Blue',
  },
  {
    id: 'spotify:track:3Z0oQ8r78OUaHvGPiDBR3W',
    title: 'Into the Unknown',
    artist: 'Idina Menzel',
    image: 'icon.png',  // Local image in same folder
    status: 'Blue',
  },
  {
    id: 'spotify:track:5k3U0OGYBccHdKJJu3HrUN',
    title: 'Hakuna Matata',
    artist: 'Nathan Lane, Ernie...',
    image: 'hakuna-matata.jpg',  // Local image in same folder
    status: 'Green',
  },
  {
    id: 'spotify:track:0OFknyqxmSQ42SoKxWVTok',
    title: 'Un Poco Loco',
    artist: 'Anthony Gonzalez',
    image: 'un-poco-loco.jpg',  // Local image in same folder
    status: 'Green',
  },
  {
    id: 'spotify:track:6U4VqEHy4n5VeiH4pQPL24',
    title: "You're Welcome",
    artist: 'Dwayne Johnson',
    image: 'youre-welcome.jpg',  // Local image in same folder
    status: 'Red',
  },
  {
    id: 'spotify:track:52xJxFP6TqMuO4Yt0eOkMz',
    title: "We Don't Talk About Bruno",
    artist: 'Carolina Gaitán',
    image: 'we-dont-talk.jpg',  // Local image in same folder
    status: 'Red',
  },
  {
    id: 'spotify:track:6oYkwjI1TKP9D0Y9II1GT7',
    title: 'Under the Sea',
    artist: 'Samuel E. Wright',
    image: 'under-the-sea.jpg',  // Local image in same folder
    status: 'Yellow',
  },
];
