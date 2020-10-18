/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare module 'sensortag' {
    export function discoverAll(cb: (tag: Tag) => void): void

    export class Tag {
        public id: string

        disconnect(callback: (error: any) => void): void
        readHumidity(callback: (error: any, temperature: number, humidity: number) => void): void
        enableHumidity(callback: (error: any) => void): void
        disableHumidity(callback: (error: any) => void): void
        connectAndSetUp(callback: (error: any) => void): void
    }
}
