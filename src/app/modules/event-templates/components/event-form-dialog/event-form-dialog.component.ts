import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { GetEventTemplateQuery } from '@tumi/legacy-app/generated/generated';
import { startWith, Subject, takeUntil } from 'rxjs';
import { IconURLPipe } from '@tumi/legacy-app/modules/shared/pipes/icon-url.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { LocationAutocompleteComponent } from '../../../shared/components/location-autocomplete/location-autocomplete.component';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { AsyncPipe, NgFor, NgIf, NgOptimizedImage } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-event-form-dialog',
  templateUrl: './event-form-dialog.component.html',
  styleUrls: ['./event-form-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    NgIf,
    MatSelectModule,
    NgFor,
    MatOptionModule,
    LocationAutocompleteComponent,
    MatCheckboxModule,
    MatButtonModule,
    AsyncPipe,
    IconURLPipe,
    NgOptimizedImage,
  ],
})
export class EventFormDialogComponent implements OnDestroy {
  public dialogForm: UntypedFormGroup;
  private destroyed$ = new Subject();

  constructor(
    private fb: UntypedFormBuilder,
    private dialog: MatDialogRef<EventFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data?: {
      template?: GetEventTemplateQuery['eventTemplate'];
      categories?: { id: string; name: string }[];
    },
  ) {
    this.dialogForm = this.fb.group({
      title: ['', Validators.required],
      icon: ['', Validators.required],
      description: ['TBD', Validators.required],
      comment: ['TBD', Validators.required],
      location: [null, Validators.required],
      duration: ['', Validators.required],
      participantText: ['TBD', Validators.required],
      organizerText: ['TBD', Validators.required],
      categoryId: [null, Validators.required],
    });
    if (!this.data?.categories) {
      this.dialogForm.get('categoryId')?.disable();
    }
    if (this.data?.template) {
      this.dialogForm.patchValue(this.data.template, { emitEvent: true });
      this.dialogForm.get('location')?.disable();
    }
  }

  onSubmit(): void {
    if (this.dialogForm.valid) {
      const templateValue = this.dialogForm.value;
      if (templateValue.location?.place_id) {
        // templateValue.coordinates = templateValue.location.position;
        const map = new google.maps.Map(document.createElement('div'));
        const service = new google.maps.places.PlacesService(map);
        service.getDetails(
          {
            placeId: templateValue.location.place_id,
            fields: ['url', 'geometry'],
          },
          (res: any) => {
            this.dialog.close({
              ...templateValue,
              coordinates: res.geometry.location,
              googlePlaceId: templateValue.location.place_id,
              googlePlaceUrl: res.url,
              location: templateValue.location.structured_formatting.main_text,
            });
          },
        );
      } else {
        this.dialog.close(templateValue);
      }
    } else {
    }
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
}
