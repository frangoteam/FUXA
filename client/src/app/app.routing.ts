import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { EditorComponent } from './editor/editor.component';
import { DeviceComponent } from './device/device.component';
import { LabComponent } from './lab/lab.component';

const appRoutes: Routes = [
    { path: '', component: HomeComponent},//, canActivate: [AuthGuard] },
    { path: 'home', component: HomeComponent},//, canActivate: [AuthGuard] },
    { path: 'editor', component: EditorComponent },
    { path: 'lab', component: LabComponent },
    { path: 'device', component: DeviceComponent },

    // otherwise redirect to home
    { path: '**', redirectTo: '' }
];

export const routing = RouterModule.forRoot(appRoutes);