export type Song = {
  title: string;
  artist: string;
  albumArt: string;
  status: 'Blue' | 'Green' | 'Yellow' | 'Red';
};

export const songs: Song[] = [
  {
    title: 'Let It Go',
    artist: 'Idina Menzel',
    albumArt: '/let-it-go.jpg',
    status: 'Green',
  },
  {
    title: 'Into the Unknown',
    artist: 'Idina Menzel',
    albumArt: '/into-the-unknown.jpg',
    status: 'Green',
  },
  {
    title: 'Hakuna Matata',
    artist: 'Nathan Lane, Ernie...',
    albumArt: '/hakuna-matata.jpg',
    status: 'Green',
  },
  {
    title: 'Un Poco Loco',
    artist: 'Anthony Gonzalez',
    albumArt: '/un-poco-loco.jpg',
    status: 'Green',
  },
  {
    title: "You're Welcome",
    artist: 'Dwayne Johnson',
    albumArt: '/youre-welcome.jpg',
    status: 'Green',
  },
  {
    title: "We Don't Talk About Bruno",
    artist: 'Carolina Gaitán',
    albumArt: '/we-dont-talk.jpg',
    status: 'Green',
  },
  {
    title: 'Under the Sea',
    artist: 'Samuel E. Wright',
    albumArt: '/under-the-sea.jpg',
    status: 'Green',
  },
];
