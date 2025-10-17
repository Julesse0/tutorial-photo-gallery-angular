import { Component, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { Subscription } from 'rxjs';
import { PhotoService, UserPhoto } from '../services/photo.service';

@Component({
  selector: 'app-tab3',
  templateUrl: './tab3.page.html'
})
export class Tab3Page implements OnDestroy {
  private map!: L.Map;
  private cluster!: any; // MarkerClusterGroup (typé en any pour compat Angular 12)
  private sub!: Subscription;
  private byId = new Map<string, any>();
  private lastBounds: L.LatLngBoundsExpression | null = null;

  constructor(public ps: PhotoService) {}

  async ionViewDidEnter() {
    if (!this.map) {
      await this.ps.loadSaved();
      this.initMap();
      this.renderAll(this.ps.photos);
      this.sub = this.ps.changed$.subscribe(arr => this.renderDiff(arr));
    }
    setTimeout(() => {
      this.map.invalidateSize();
      if (this.lastBounds) this.map.fitBounds(this.lastBounds as any, { padding: [24, 24] });
    }, 0);
  }

  ngOnDestroy() { if (this.sub) this.sub.unsubscribe(); }

  private initMap() {
    this.map = L.map('map', { zoomControl: true }).setView([43.3, 5.4], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(this.map);
    this.cluster = (L as any).markerClusterGroup({
      spiderfyOnEveryZoom: false,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60
    });
    this.cluster.addTo(this.map);
  }

  private icon() {
    return L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });
  }

  private renderAll(list: UserPhoto[]) {
    const icon = this.icon();
    const bounds: L.LatLngExpression[] = [];
    for (const p of list) {
      if (p.latitude != null && p.longitude != null && !this.byId.has(p.id)) {
        const m = L.marker([p.latitude, p.longitude], { icon }).bindPopup(this.popupHtml(p));
        this.cluster.addLayer(m);
        this.byId.set(p.id, m);
        bounds.push([p.latitude, p.longitude]);
      }
    }
    if (bounds.length) {
      this.lastBounds = L.latLngBounds(bounds);
      this.map.fitBounds(this.lastBounds as any, { padding: [24, 24] });
    }
  }

  private renderDiff(list: UserPhoto[]) {
    const ids = new Set(list.map(p => p.id));
    for (const [id, mk] of Array.from(this.byId.entries())) {
      if (!ids.has(id)) {
        this.cluster.removeLayer(mk);
        this.byId.delete(id);
      }
    }
    const icon = this.icon();
    const newBounds: L.LatLngExpression[] = [];
    for (const p of list) {
      if (p.latitude != null && p.longitude != null && !this.byId.has(p.id)) {
        const m = L.marker([p.latitude, p.longitude], { icon }).bindPopup(this.popupHtml(p));
        this.cluster.addLayer(m);
        this.byId.set(p.id, m);
        newBounds.push([p.latitude, p.longitude]);
      }
    }
    if (newBounds.length) {
      this.lastBounds = this.lastBounds
        ? (this.lastBounds as any).extend(L.latLngBounds(newBounds))
        : L.latLngBounds(newBounds);
      this.map.fitBounds(this.lastBounds as any, { padding: [24, 24] });
    }
  }

  private popupHtml(p: UserPhoto) {
    const d = new Date(p.createdAt).toLocaleString();
    return `<img src="${p.webviewPath}" style="max-width:240px;max-height:180px;border-radius:8px;display:block;margin-bottom:6px;">
            <div style="font-size:12px;color:#555;">${d}</div>`;
  }
}
