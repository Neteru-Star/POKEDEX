import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'pokemon/:id',
    loadComponent: () =>
      import('./pages/pokemon-detail/pokemon-detail.page').then((m) => m.PokemonDetailPage),
  },
  {
    path: 'scanner',
    loadComponent: () => import('./pages/scanner/scanner.page').then((m) => m.ScannerPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
