export type Song = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  status: 'Blue' | 'Green' | 'Yellow' | 'Red';
};

export const songs: Song[] = [
  {
    id: 'spotify:track:0qcr5FMsEO85NAQjrlDRKo',
    title: 'Let It Go',
    artist: 'Idina Menzel',
    albumArt: 'letitgo',
    status: 'Blue',
  },
  {
    id: 'spotify:track:3Z0oQ8r78OUaHvGPiDBR3W',
    title: 'Into the Unknown',
    artist: 'Idina Menzel',
    albumArt: '../../../assets/icon.png',
    status: 'Blue',
  },
  {
    id: 'spotify:track:5k3U0OGYBccHdKJJu3HrUN',
    title: 'Hakuna Matata',
    artist: 'Nathan Lane, Ernie...',
    albumArt: '/hakuna-matata.jpg',
    status: 'Green',
  },
  {
    id: 'spotify:track:0OFknyqxmSQ42SoKxWVTok',
    title: 'Un Poco Loco',
    artist: 'Anthony Gonzalez',
    albumArt: '/un-poco-loco.jpg',
    status: 'Green',
  },
  {
    id: 'spotify:track:6U4VqEHy4n5VeiH4pQPL24',
    title: "You're Welcome",
    artist: 'Dwayne Johnson',
    albumArt: '/youre-welcome.jpg',
    status: 'Red',
  },
  {
    id: 'spotify:track:52xJxFP6TqMuO4Yt0eOkMz',
    title: "We Don't Talk About Bruno",
    artist: 'Carolina Gaitán',
    albumArt: '/we-dont-talk.jpg',
    status: 'Red',
  },
  {
    id: 'spotify:track:6oYkwjI1TKP9D0Y9II1GT7',
    title: 'Under the Sea',
    artist: 'Samuel E. Wright',
    albumArt: '/under-the-sea.jpg',
    status: 'Yellow',
  },
];
