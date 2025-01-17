import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  firstValueFrom,
  map,
  Observable,
  Subject,
  takeUntil,
} from 'rxjs';
import {
  ProgressBarMode,
  MatProgressBarModule,
} from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PhotoDetailsDialogComponent } from '@tumi/legacy-app/modules/shared/components/photo-details-dialog/photo-details-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BlobServiceClient } from '@azure/storage-blob';
import {
  CreatePhotoShareGQL,
  GetPhotoShareKeyGQL,
  GetPhotosOfEventGQL,
  GetPhotosOfEventQuery,
} from '@tumi/legacy-app/generated/generated';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NgIf, NgFor, AsyncPipe, NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-event-photo-page',
  templateUrl: './event-photo-page.component.html',
  styleUrls: ['./event-photo-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    NgFor,
    AsyncPipe,
    NgOptimizedImage,
  ],
})
export class EventPhotoPageComponent implements OnDestroy {
  public photos$: Observable<GetPhotosOfEventQuery['photos']>;
  public event$: Observable<GetPhotosOfEventQuery['event']>;
  public uploadProgress$ = new BehaviorSubject(0);
  public uploadMode$ = new BehaviorSubject<ProgressBarMode>('indeterminate');
  public uploading$ = new BehaviorSubject(false);
  private loadPhotosRef;
  private destroyed$ = new Subject();
  constructor(
    private loadPhotos: GetPhotosOfEventGQL,
    private getShareKey: GetPhotoShareKeyGQL,
    private createPhotoShare: CreatePhotoShareGQL,
    private snackbar: MatSnackBar,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {
    this.loadPhotosRef = this.loadPhotos.watch();
    this.photos$ = this.loadPhotosRef.valueChanges.pipe(
      map(({ data }) => data.photos),
    );
    this.event$ = this.loadPhotosRef.valueChanges.pipe(
      map(({ data }) => data.event),
    );
    this.route.paramMap
      .pipe(takeUntil(this.destroyed$))
      .subscribe((params) =>
        this.loadPhotosRef.refetch({ eventId: params.get('eventId') ?? '' }),
      );
  }
  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
  get canShareImage() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return !!navigator.canShare;
  }

  async sharePhotos() {
    this.uploading$.next(true);
    this.uploadMode$.next('query');
    const photos = await firstValueFrom(this.photos$);
    const event = await firstValueFrom(this.event$);
    const files = await Promise.all(
      photos.map((photo: any) =>
        firstValueFrom(
          this.http.get(photo.original, { responseType: 'blob' }),
        ).then(
          (blob) => new File([blob], photo.originalBlob, { type: photo.type }),
        ),
      ),
    );
    try {
      await navigator.share({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        files: files,
        title: event?.title,
      });
    } catch (e) {
      this.snackbar.open('Sharing failed ' + e);
    }
    this.uploading$.next(false);
  }

  async addFile(fileEvent: Event) {
    this.uploading$.next(true);
    this.uploadMode$.next('indeterminate');
    const target = fileEvent.target as HTMLInputElement;
    const event = await firstValueFrom(this.event$);
    if (target && target.files && event) {
      const files = Array.from(target.files).filter((file) =>
        file.type.startsWith('image/'),
      );

      const { data } = await firstValueFrom(this.getShareKey.fetch());
      const uploads = new BehaviorSubject(files.map(() => 0));
      uploads.subscribe((progress) => {
        const totalProgress =
          progress.reduce(
            (previousValue, currentValue) => previousValue + currentValue,
            0,
          ) / progress.length;
        if (totalProgress > 0) {
          this.uploadMode$.next('determinate');
          this.uploadProgress$.next(totalProgress);
        }
      });
      await Promise.all(
        files.map(async (file, index) => {
          const reader = new FileReader();
          const image = new Image();
          const imagePromise = new Promise<void>((resolve) => {
            reader.onload = () => {
              image.onload = () => resolve();
              image.src = reader.result as string;
            };
          });
          reader.readAsDataURL(file);
          await imagePromise;
          const ratio = image.width / image.height;
          const cols = ratio > 1.25 ? 2 : 1;
          const rows = ratio < 0.75 ? 2 : 1;
          const blobServiceClient = new BlobServiceClient(data.photoShareKey);
          const container = event.id + '|' + event.title;
          const blob = this.randomId() + '|' + file.name;
          const containerClient =
            blobServiceClient.getContainerClient(container);
          const blockBlobClient = containerClient.getBlockBlobClient(blob);
          await blockBlobClient.uploadBrowserData(file, {
            blobHTTPHeaders: {
              blobContentType: file.type,
            },
            onProgress: (event) => {
              const newUploads = [...uploads.value];
              newUploads[index] = (event.loadedBytes / file.size) * 100;
              uploads.next(newUploads);
            },
          });
          await firstValueFrom(
            this.createPhotoShare.mutate({
              eventId: event.id,
              data: {
                cols,
                rows,
                container,
                originalBlob: blob,
                type: file.type,
              },
            }),
          );
        }),
      );
      uploads.complete();
      this.snackbar.open(`✔️ ${files.length} Photos uploaded`);
      this.uploadProgress$.next(0);
      this.uploading$.next(false);
      this.loadPhotosRef.refetch();
    }
  }

  openPhoto(photo: unknown): void {
    this.dialog.open(PhotoDetailsDialogComponent, {
      data: { photo },
      maxHeight: '95vh',
      maxWidth: '95vw',
      panelClass: 'photo-view',
    });
  }

  private randomId(): string {
    const uint32 = crypto.getRandomValues(new Uint32Array(1))[0];
    return uint32.toString(16);
  }
}
