import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { filter, tap } from 'rxjs';
import { GetCurrentUserGQL } from '@tumi/legacy-app/generated/generated';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { retryBackoff } from 'backoff-rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, AsyncPipe, NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-auth-button',
  templateUrl: './auth-button.component.html',
  styleUrls: ['./auth-button.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    AsyncPipe,
    NgOptimizedImage,
  ],
})
export class AuthButtonComponent {
  public userPicture: string = '';

  constructor(
    public auth: AuthService,
    private snackBar: MatSnackBar,
    router: Router,
    getUser: GetCurrentUserGQL,
  ) {
    auth.isAuthenticated$.pipe(filter((auth) => auth)).subscribe(() => {
      getUser
        .fetch()
        .pipe(
          tap((user) => {
            this.userPicture = user.data.currentUser?.picture || '';
            if (
              !user.data.currentUser ||
              !user.data.currentUser.profileComplete
            ) {
              router.navigate(['/', 'profile', 'new']);
            }
          }),
          // map((user) => {
          //   if (!user.data.currentUser) throw new Error('not logged in');
          //   return user;
          // }),
          retryBackoff({ initialInterval: 100, maxRetries: 5 }),
        )
        .subscribe({
          error: (err) => {
            console.log(err);
            this.snackBar
              .open('Error loading user', 'Reload Page', { duration: 0 })
              .afterDismissed()
              .subscribe(() => {
                window.location.reload();
              });
          },
        });
    });
  }
}
