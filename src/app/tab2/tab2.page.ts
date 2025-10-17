import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { PhotoService, UserPhoto } from '../services/photo.service';

@Component({
  selector: 'app-tab2',
  templateUrl: './tab2.page.html',
  providers: [DatePipe]
})
export class Tab2Page implements OnInit, OnDestroy {
  favs: UserPhoto[] = [];
  selected: UserPhoto | null = null;
  private sub!: Subscription;

  constructor(public ps: PhotoService, private date: DatePipe) {}

  async ngOnInit() {
    await this.ps.loadSaved();
    this.refresh();
    this.sub = this.ps.changed$.subscribe(() => this.refresh());
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  refresh() {
    this.favs = this.ps.photos.filter(p => p.liked);
  }

  when(iso: string) {
    return this.date.transform(iso, 'dd/MM/yyyy HH:mm');
  }

  async toggle(p: UserPhoto) {
    await this.ps.toggleLike(p.id);
  }

  open(p: UserPhoto) {
    this.selected = p;
  }

  close() {
    this.selected = null;
  }
}
