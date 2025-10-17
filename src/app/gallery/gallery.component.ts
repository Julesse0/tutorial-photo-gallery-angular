import { Component, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { PhotoService, UserPhoto } from '../services/photo.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-gallery',
  templateUrl: './gallery.component.html',
  providers: [DatePipe]
})
export class GalleryComponent implements OnInit, OnDestroy {
  selected: UserPhoto|null = null;
  private sub?: Subscription;
  photos: UserPhoto[] = [];

  constructor(public ps: PhotoService, private date: DatePipe, private cd: ChangeDetectorRef, private router: Router) {}

  async ngOnInit() { 
    await this.ps.loadSaved();
    this.photos = [...this.ps.photos];
    
    this.sub = this.ps.changed$.subscribe((photos) => {
      this.photos = [...photos];
      this.cd.detectChanges();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  async like(p: UserPhoto) { 
    await this.ps.toggleLike(p.id); 
  }

  when(iso: string) { 
    return this.date.transform(iso, 'dd/MM/yyyy HH:mm'); 
  }

  async remove(i: number, p: UserPhoto) { 
    await this.ps.deletePicture(p, i); 
  }

  async take() { 
    await this.ps.addNewToGallery(); 
  }

  open(p: UserPhoto) { 
    this.selected = p; 
  }

  close() { 
    this.selected = null; 
  }

  goToMap(p: UserPhoto) { 
    if (p.latitude!=null && p.longitude!=null) 
      this.router.navigate(['/tabs','tab3'], { queryParams: { id: p.id, lat: p.latitude, lon: p.longitude } }); 
  }

  label(p: UserPhoto) {
    if (p.place) return p.place;
    if (p.latitude!=null && p.longitude!=null) return `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
    return 'Localisation inconnue';
  }
}