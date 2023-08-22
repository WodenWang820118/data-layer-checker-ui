import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { EventBusService } from '../../../services/event-bus/event-bus.service';
import { EMPTY, Observable, catchError, filter, take, tap } from 'rxjs';
import { ViewEncapsulation } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { WebWorkerService } from '../../../services/web-worker/web-worker.service';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { setInitialScrollTop } from './dom-helper';
import { XlsxProcessingService } from '../../services/xlsx-processing/xlsx-processing.service';

@Component({
  selector: 'app-xlsx-sidenav-form',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatButtonModule,
    MatFormFieldModule,
    MatCardModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    CommonModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatTableModule,
  ],
  templateUrl: `./xlsx-sidenav-form.component.html`,
  styleUrls: ['./xlsx-sidenav-form.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class XlsxSidenavFormComponent implements AfterViewInit {
  @ViewChild('sidenav') sidenav: MatSidenav | undefined;
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;

  fileName$ = this.xlsxProcessing.fileName$ as Observable<string>;
  worksheetNames$ = this.xlsxProcessing.worksheetNames$ as Observable<string[]>;
  workbook$ = this.xlsxProcessing.workbook$ as Observable<any>;
  dataSource$ = this.xlsxProcessing.dataSource$ as Observable<any[]>;
  displayedDataSource$ = this.xlsxProcessing.displayedDataSource$ as Observable<
    any[]
  >;
  displayedColumns$ = this.xlsxProcessing.displayedColumns$ as Observable<
    string[]
  >;

  file: File | undefined;
  dataColumnNameString = 'dataLayer specs';

  form = this.fb.group({
    worksheetNames: [''],
    dataColumnName: [this.dataColumnNameString, Validators.required],
  });

  constructor(
    private eventBusService: EventBusService,
    private fb: FormBuilder,
    private webWorkerService: WebWorkerService,
    private dialog: MatDialog,
    public xlsxProcessing: XlsxProcessingService
  ) {}

  ngAfterViewInit() {
    this.initEventBusListeners();
    setInitialScrollTop(this.scrollContainer);
  }

  toggleSidenav() {
    if (!this.sidenav) return;

    this.sidenav.toggle();

    // Check if sidenav is opened or closed and adjust body overflow accordingly.
    if (this.sidenav.opened) {
      document.body.style.overflow = 'hidden'; // This will disable scrolling.
    } else {
      document.body.style.overflow = 'auto'; // This will enable scrolling back.
    }
  }

  // Event bus listeners

  private initEventBusListeners() {
    this.eventBusService
      .on('toggleDrawer')
      .pipe(
        tap((file) => {
          console.log(file, ' from initEventBusListeners');
          this.toggleSidenav();
          this.xlsxProcessing.loadXlsxFile(file);
        })
      )
      .subscribe();
  }

  // Event bus post messages

  switchToSelectedSheet(event: any) {
    const sheetName = event.target.value;
    this.workbook$
      .pipe(
        take(1),
        tap((workbook) =>
          this.postDataToWorker('switchSheet', workbook, sheetName)
        )
      )
      .subscribe();
  }

  retrieveSpecsFromSource() {
    const titleName = this.form.get('dataColumnName')?.value as string;

    this.dataSource$
      .pipe(
        take(1),
        filter((data) => !!data), // Ensure that data exists
        tap((data) => this.postDataToWorker('extractSpecs', data, titleName)),
        catchError(() => {
          this.handlePostError(titleName);
          return EMPTY; // `EMPTY` is an observable that completes immediately without emitting any value.
        })
      )
      .subscribe();
  }

  previewData() {
    const titleName = this.form.get('dataColumnName')?.value as string;

    this.displayedDataSource$
      .pipe(
        take(1),
        filter((data) => !!data), // Ensure that data exists
        tap((data) => this.postDataToWorker('previewData', data, titleName)),
        catchError(() => {
          this.handlePostError(titleName);
          return EMPTY;
        })
      )
      .subscribe();
  }

  // Private utilities

  private postDataToWorker(action: string, data: any, titleName: string) {
    this.webWorkerService.postMessage('message', {
      action,
      data,
      titleName,
    });
  }

  private handlePostError(titleName: string) {
    this.dialog.open(ErrorDialogComponent, {
      data: {
        message: `Failed to extract specs from the title: ${titleName}`,
      },
    });
  }
}
