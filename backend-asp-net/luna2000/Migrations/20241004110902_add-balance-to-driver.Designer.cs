﻿// <auto-generated />
using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using luna2000.Data;

#nullable disable

namespace luna2000.Migrations
{
    [DbContext(typeof(LunaDbContext))]
    [Migration("20241004110902_add-balance-to-driver")]
    partial class addbalancetodriver
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder.HasAnnotation("ProductVersion", "6.0.33");

            modelBuilder.Entity("luna2000.Models.CarEntity", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<string>("BrandModel")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Kasko")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<bool>("Leasing")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Osago")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("PlateNumber")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Pts")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("PurchaseOrRent")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<DateOnly>("RegistrationDate")
                        .HasColumnType("TEXT");

                    b.Property<string>("Sts")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<bool>("TaxiLicense")
                        .HasColumnType("INTEGER");

                    b.Property<DateOnly>("TechInspection")
                        .HasColumnType("TEXT");

                    b.Property<string>("Vin")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Year")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.ToTable("Cars");
                });

            modelBuilder.Entity("luna2000.Models.CarRentalEntity", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<Guid>("CarId")
                        .HasColumnType("TEXT");

                    b.Property<Guid>("DriverId")
                        .HasColumnType("TEXT");

                    b.Property<decimal>("Rent")
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("CarId");

                    b.HasIndex("DriverId");

                    b.ToTable("CarRentals");
                });

            modelBuilder.Entity("luna2000.Models.DriverEntity", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<string>("Address")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<decimal>("Balance")
                        .HasColumnType("TEXT");

                    b.Property<string>("Contacts")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("DriverLicense")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Fio")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Note")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("ParkingAddress")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Passport")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Registration")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.ToTable("Drivers");
                });

            modelBuilder.Entity("luna2000.Models.PhotoEntity", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<Guid?>("CarId")
                        .HasColumnType("TEXT");

                    b.Property<Guid?>("DriverId")
                        .HasColumnType("TEXT");

                    b.Property<string>("FileExtension")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<Guid>("FileId")
                        .HasColumnType("TEXT");

                    b.Property<string>("FileName")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.HasIndex("CarId");

                    b.HasIndex("DriverId");

                    b.ToTable("Photos");
                });

            modelBuilder.Entity("luna2000.Models.UserEntity", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("TEXT");

                    b.Property<string>("Login")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Name")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Password")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.HasKey("Id");

                    b.ToTable("Users");
                });

            modelBuilder.Entity("luna2000.Models.CarRentalEntity", b =>
                {
                    b.HasOne("luna2000.Models.CarEntity", "Car")
                        .WithMany()
                        .HasForeignKey("CarId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("luna2000.Models.DriverEntity", "Driver")
                        .WithMany()
                        .HasForeignKey("DriverId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Car");

                    b.Navigation("Driver");
                });

            modelBuilder.Entity("luna2000.Models.PhotoEntity", b =>
                {
                    b.HasOne("luna2000.Models.CarEntity", "Car")
                        .WithMany("Photos")
                        .HasForeignKey("CarId");

                    b.HasOne("luna2000.Models.DriverEntity", "Driver")
                        .WithMany("Photos")
                        .HasForeignKey("DriverId");

                    b.Navigation("Car");

                    b.Navigation("Driver");
                });

            modelBuilder.Entity("luna2000.Models.CarEntity", b =>
                {
                    b.Navigation("Photos");
                });

            modelBuilder.Entity("luna2000.Models.DriverEntity", b =>
                {
                    b.Navigation("Photos");
                });
#pragma warning restore 612, 618
        }
    }
}
